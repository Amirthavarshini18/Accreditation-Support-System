import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import pandas as pd
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from .models import Faculty, SystemSetting
from .services.calculator import DEFAULT_COURSE_DATA, calculate_course_attainment
from .services.excel_parser import parse_accreditation_workbook, parse_marks_workbook

User = get_user_model()


def get_auth_config():
    """Fetch allowed domains and institution name from SystemSetting table with fallbacks."""
    try:
        raw = SystemSetting.objects.get(key='allowed_email_domain').value.strip().lower()
        domains = [d.strip() for d in raw.split(',') if d.strip()]
    except SystemSetting.DoesNotExist:
        setting = getattr(settings, 'ALLOWED_EMAIL_DOMAINS', None)
        if isinstance(setting, list):
            domains = [d.strip().lower() for d in setting if d.strip()]
        else:
            raw = getattr(settings, 'ALLOWED_EMAIL_DOMAIN', '')
            domains = [d.strip().lower() for d in raw.split(',') if d.strip()]

    try:
        inst = SystemSetting.objects.get(key='institution_name').value.strip()
    except SystemSetting.DoesNotExist:
        inst = "NIT Calicut"

    return domains, inst


def _faculty_payload(user):
    return {
        'id':          user.id,
        'name':        user.name or user.get_full_name() or user.username,
        'email':       user.email,
        'department':  user.department,
        'designation': user.designation,
        'employeeId':  user.employee_id,
    }


def _validate_domain(email):
    """Return error string or None."""
    domains, inst = get_auth_config()
    if domains and not any(email.lower().endswith(f'@{d}') for d in domains):
        return f'Only {inst} email addresses ({", ".join("@"+d for d in domains)}) are permitted.'
    return None


@csrf_exempt
def auth_config(request):
    """Public endpoint to fetch authentication settings."""
    if request.method != 'GET':
        return JsonResponse({'message': 'GET request required'}, status=405)
    domains, inst = get_auth_config()
    try:
        client_id = SystemSetting.objects.get(key='google_client_id').value.strip()
    except SystemSetting.DoesNotExist:
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '').strip()

    return JsonResponse({
        'success': True,
        'allowedDomain': domains[0] if domains else '',
        'allowedDomains': domains,
        'institutionName': inst,
        'googleClientId': client_id,
    })


def _jwt_user(request):
    """Extract authenticated FacultyUser from JWT Bearer token. Returns user or None."""
    try:
        auth = JWTAuthentication()
        validated = auth.authenticate(request)
        if validated is None:
            return None
        return validated[0]
    except Exception:
        return None


def jwt_required(view_func):
    """Decorator: reject requests without a valid JWT."""
    @csrf_exempt
    def wrapper(request, *args, **kwargs):
        user = _jwt_user(request)
        if user is None:
            return JsonResponse({'success': False, 'message': 'Authentication required.'}, status=401)
        request.faculty_user = user
        return view_func(request, *args, **kwargs)
    return wrapper


def read_uploaded_table(uploaded_file):
    file_name = uploaded_file.name.lower()
    if file_name.endswith(".csv"):
        df = pd.read_csv(uploaded_file)
    elif file_name.endswith(".xlsx"):
        df = pd.read_excel(uploaded_file, engine="openpyxl")
    elif file_name.endswith(".xls"):
        df = pd.read_excel(uploaded_file, engine="xlrd")
    else:
        raise ValueError("Unsupported file format")
    return df.dropna(how="all").dropna(axis=1, how="all")


def normalize_column_name(value):
    return str(value).strip().lower().replace(" ", "").replace("_", "").replace("-", "")


@csrf_exempt
def faculty_register(request):
    """Register a new faculty account (open endpoint — domain-restricted)."""
    if request.method != 'POST':
        return JsonResponse({'message': 'Faculty registration endpoint ready'})
    try:
        payload     = json.loads(request.body.decode('utf-8'))
        email       = payload.get('email', '').strip().lower()
        password    = payload.get('password', '').strip()
        name        = payload.get('name', '').strip()
        department  = payload.get('department', '').strip()
        designation = payload.get('designation', '').strip()
        employee_id = payload.get('employeeId', '').strip()

        if not email or not password:
            return JsonResponse({'success': False, 'message': 'Email and password are required.'}, status=400)

        err = _validate_domain(email)
        if err:
            return JsonResponse({'success': False, 'message': err}, status=400)

        if len(password) < 6:
            return JsonResponse({'success': False, 'message': 'Password must be at least 6 characters.'}, status=400)

        if User.objects.filter(email=email).exists():
            return JsonResponse({'success': False, 'message': 'An account with this email already exists.'}, status=400)

        username = email.split('@')[0]
        # ensure unique username
        base, counter = username, 1
        while User.objects.filter(username=username).exists():
            username = f'{base}{counter}'
            counter += 1

        first, *rest = (name or username).split(' ', 1)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            name=name,
            first_name=first,
            last_name=rest[0] if rest else '',
            department=department,
            designation=designation,
            employee_id=employee_id,
        )

        refresh = RefreshToken.for_user(user)
        return JsonResponse({
            'success':      True,
            'message':      'Account created successfully.',
            'faculty':      _faculty_payload(user),
            'accessToken':  str(refresh.access_token),
            'refreshToken': str(refresh),
        })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON payload.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def faculty_login(request):
    """Authenticate with email + password, return JWT pair."""
    if request.method != 'POST':
        return JsonResponse({'message': 'Faculty login endpoint ready'})
    try:
        payload  = json.loads(request.body.decode('utf-8'))
        email    = payload.get('email', '').strip().lower()
        password = payload.get('password', '')

        if not email or not password:
            return JsonResponse({'success': False, 'message': 'Email and password are required.'}, status=400)

        err = _validate_domain(email)
        if err:
            return JsonResponse({'success': False, 'message': err}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'No account found for this email. Please register first.'}, status=401)

        if not user.check_password(password):
            return JsonResponse({'success': False, 'message': 'Incorrect password.'}, status=401)

        if not user.is_active:
            return JsonResponse({'success': False, 'message': 'This account has been deactivated.'}, status=403)

        refresh = RefreshToken.for_user(user)
        return JsonResponse({
            'success':      True,
            'message':      'Login successful.',
            'faculty':      _faculty_payload(user),
            'accessToken':  str(refresh.access_token),
            'refreshToken': str(refresh),
        })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON payload.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def google_login(request):
    """Verify Google ID token, authenticate existing faculty, or register new faculty."""
    if request.method != 'POST':
        return JsonResponse({'message': 'Google login endpoint ready'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8'))
        credential = payload.get('credential', '').strip()

        if not credential:
            # Hybrid mode fallback: if in DEBUG mode, allow manual mock login info
            email = payload.get('email', '').strip().lower()
            name = payload.get('name', '').strip()
            if settings.DEBUG and email:
                google_data = {
                    'email': email,
                    'name': name or email.split('@')[0],
                    'aud': '',  # Bypasses audience check below
                }
            else:
                return JsonResponse({'success': False, 'message': 'Google ID token (credential) is required.'}, status=400)
        else:
            # Verify ID token with Google's public endpoint
            import urllib.request
            token_info_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
            try:
                req = urllib.request.Request(token_info_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    google_data = json.loads(response.read().decode('utf-8'))
            except Exception as e:
                return JsonResponse({'success': False, 'message': f'Failed to verify token with Google: {str(e)}'}, status=400)

        email = google_data.get('email', '').strip().lower()
        name = google_data.get('name', '').strip()

        if not email:
            return JsonResponse({'success': False, 'message': 'Email address not provided by Google.'}, status=400)

        # Check domain constraint
        err = _validate_domain(email)
        if err:
            return JsonResponse({'success': False, 'message': err}, status=400)

        # Verify audience (aud) matches the Google Client ID if configured
        try:
            client_id = SystemSetting.objects.get(key='google_client_id').value.strip()
        except SystemSetting.DoesNotExist:
            client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '').strip()

        aud = google_data.get('aud', '')
        if credential and client_id and aud != client_id:
            return JsonResponse({'success': False, 'message': 'Token audience mismatch (invalid client ID).'}, status=400)

        # Get or create user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Create user automatically if it is a new Google user
            username = email.split('@')[0]
            base, counter = username, 1
            while User.objects.filter(username=username).exists():
                username = f'{base}{counter}'
                counter += 1

            first, *rest = (name or username).split(' ', 1)
            import uuid
            user = User.objects.create_user(
                username=username,
                email=email,
                password=str(uuid.uuid4()),
                name=name,
                first_name=first,
                last_name=rest[0] if rest else '',
                department='Computer Science & Engineering',
                designation='Assistant Professor',
                employee_id='',
            )

        if not user.is_active:
            return JsonResponse({'success': False, 'message': 'This account has been deactivated.'}, status=403)

        refresh = RefreshToken.for_user(user)
        return JsonResponse({
            'success':      True,
            'message':      'Login successful via Google.',
            'faculty':      _faculty_payload(user),
            'accessToken':  str(refresh.access_token),
            'refreshToken': str(refresh),
        })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON payload.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def google_auth_api(request):
    """
    POST /api/auth/google/
    Verifies Google ID token and returns JWT access and refresh tokens.
    """
    if request.method != 'POST':
        return JsonResponse({'message': 'POST request required'}, status=405)

    try:
        payload = json.loads(request.body.decode('utf-8'))
        credential = payload.get('credential', '').strip()

        if not credential:
            return JsonResponse({'success': False, 'message': 'Google ID token (credential) is required.'}, status=400)

        # Verify the Google ID token via Google's tokeninfo endpoint
        import urllib.request as urlreq
        try:
            req = urlreq.Request(
                f'https://oauth2.googleapis.com/tokeninfo?id_token={credential}',
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urlreq.urlopen(req, timeout=10) as resp:
                idinfo = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            return JsonResponse({'success': False, 'message': f'Failed to verify token with Google: {str(e)}'}, status=400)

        # Validate audience matches our client ID
        try:
            client_id = SystemSetting.objects.get(key='google_client_id').value.strip()
        except SystemSetting.DoesNotExist:
            client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '').strip()

        if client_id and idinfo.get('aud') != client_id:
            return JsonResponse({'success': False, 'message': 'Token audience mismatch.'}, status=400)

        email = idinfo.get('email', '').strip().lower()
        name = idinfo.get('name', '').strip()
        email_verified = idinfo.get('email_verified', False)

        if not email:
            return JsonResponse({'success': False, 'message': 'Email not provided by Google.'}, status=400)

        if str(email_verified).lower() != 'true':
            return JsonResponse({'success': False, 'message': 'Google email address is not verified.'}, status=400)

        # Reject login if email does not match any allowed domain (empty list = allow all)
        domains, inst = get_auth_config()
        if domains and not any(email.endswith(f'@{d}') for d in domains):
            return JsonResponse({'success': False, 'message': f'Only {inst} email accounts ({", ".join("@"+d for d in domains)}) are allowed.'}, status=400)

        # Create or update user
        try:
            user = User.objects.get(email=email)
            if name and user.name != name:
                user.name = name
                first, *rest = name.split(' ', 1)
                user.first_name = first
                user.last_name = rest[0] if rest else ''
                user.save()
        except User.DoesNotExist:
            department = payload.get('department', '').strip()
            designation = payload.get('designation', '').strip()
            employee_id = payload.get('employee_id', '').strip()
            custom_name = payload.get('name', '').strip() or name

            if not department or not designation:
                return JsonResponse({
                    'success': False,
                    'is_registered': False,
                    'email': email,
                    'name': name,
                    'message': 'Account not registered. Please complete registration.'
                }, status=404)

            username = email.split('@')[0]
            base, counter = username, 1
            while User.objects.filter(username=username).exists():
                username = f'{base}{counter}'
                counter += 1

            first, *rest = custom_name.split(' ', 1)
            import uuid
            user = User.objects.create_user(
                username=username,
                email=email,
                password=str(uuid.uuid4()),
                name=custom_name,
                first_name=first,
                last_name=rest[0] if rest else '',
                department=department,
                designation=designation,
                employee_id=employee_id,
            )

        if not user.is_active:
            return JsonResponse({'success': False, 'message': 'This account has been deactivated.'}, status=403)

        refresh = RefreshToken.for_user(user)
        return JsonResponse({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': _faculty_payload(user),
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON payload.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def token_refresh(request):
    """Exchange a refresh token for a new access token."""
    if request.method != 'POST':
        return JsonResponse({'message': 'Token refresh endpoint ready'})
    try:
        payload       = json.loads(request.body.decode('utf-8'))
        refresh_token = payload.get('refreshToken', '')
        if not refresh_token:
            return JsonResponse({'success': False, 'message': 'Refresh token required.'}, status=400)
        token = RefreshToken(refresh_token)
        return JsonResponse({'success': True, 'accessToken': str(token.access_token)})
    except (TokenError, InvalidToken) as e:
        return JsonResponse({'success': False, 'message': 'Invalid or expired refresh token.'}, status=401)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
def faculty_logout(request):
    """Logout: blacklist the provided refresh token and let client clear local storage."""
    if request.method != 'POST':
        return JsonResponse({'message': 'Logout endpoint ready'})

    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
        refresh_token = (payload.get('refreshToken') or '').strip()
        if not refresh_token:
            # Still allow logout even if client doesn't send token
            return JsonResponse({'success': True, 'message': 'Logged out successfully.'})

        # Correct SimpleJWT API: blacklist() adds the token to the OutstandingToken +
        # BlacklistedToken tables, preventing further use even before expiry.
        token = RefreshToken(refresh_token)
        token.blacklist()

        return JsonResponse({'success': True, 'message': 'Logged out successfully.'})
    except Exception:
        # On any token parsing/blacklisting error, still succeed logout from client perspective
        return JsonResponse({'success': True, 'message': 'Logged out successfully.'})


@jwt_required
def faculty_profile(request):
    """Return the authenticated faculty's profile."""
    return JsonResponse({'success': True, 'faculty': _faculty_payload(request.faculty_user)})


@jwt_required
def sample_data(request):
    return JsonResponse({"success": True, "data": DEFAULT_COURSE_DATA})


@jwt_required
@csrf_exempt
def compute_attainment(request):
    if request.method != "POST":
        return JsonResponse({"message": "Attainment calculation endpoint ready"})

    try:
        payload = json.loads(request.body.decode("utf-8"))
        report = calculate_course_attainment(payload)
        return JsonResponse({"success": True, "report": report})
    except json.JSONDecodeError:
        return JsonResponse(
            {"success": False, "message": "Invalid JSON payload"},
            status=400,
        )
    except Exception as error:
        return JsonResponse(
            {"success": False, "message": str(error)},
            status=500,
        )


@jwt_required
@csrf_exempt
def upload_students(request):
    if request.method != "POST":
        return JsonResponse({"message": "Student upload endpoint ready"})

    try:
        uploaded_file = request.FILES.get("file")
        question_ids = json.loads(request.POST.get("questionIds", "[]"))
        if not uploaded_file:
            return JsonResponse({"success": False, "message": "No file uploaded"}, status=400)

        if uploaded_file.name.lower().endswith(".xlsx"):
            uploaded_file.seek(0)
            parsed = parse_marks_workbook(uploaded_file)
            return JsonResponse(
                {
                    "success": True,
                    "message": parsed["message"],
                    "students": parsed["students"],
                    "questions": parsed["questions"],
                    "coSummary": parsed["coSummary"],
                }
            )

        df = read_uploaded_table(uploaded_file).fillna("")
        normalized_columns = {normalize_column_name(column): column for column in df.columns}
        register_column = (
            normalized_columns.get("registernumber")
            or normalized_columns.get("regno")
            or normalized_columns.get("rollno")
            or normalized_columns.get("studentid")
        )
        name_column = (
            normalized_columns.get("studentname")
            or normalized_columns.get("name")
        )
        section_column = normalized_columns.get("section")

        students = []
        for index, row in df.iterrows():
            register_number = str(row.get(register_column, f"REG{index + 1:03d}")).strip()
            student_name = str(row.get(name_column, f"Student {index + 1}")).strip()
            section = str(row.get(section_column, "")).strip() if section_column else ""
            marks = {}
            for question_id in question_ids:
                column = normalized_columns.get(normalize_column_name(question_id))
                marks[question_id] = float(row.get(column, 0) or 0) if column else 0
            students.append(
                {
                    "registerNumber": register_number,
                    "name": student_name,
                    "section": section,
                    "marks": marks,
                }
            )

        return JsonResponse(
            {
                "success": True,
                "message": f"{len(students)} students imported",
                "students": students,
                "columns": list(df.columns.astype(str)),
            }
        )
    except Exception as error:
        return JsonResponse({"success": False, "message": str(error)}, status=500)


@jwt_required
@csrf_exempt
def upload_indirect_survey(request):
    if request.method != "POST":
        return JsonResponse({"message": "Indirect survey upload endpoint ready"})

    try:
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return JsonResponse({"success": False, "message": "No file uploaded"}, status=400)

        df = read_uploaded_table(uploaded_file).fillna(0)
        normalized_columns = {normalize_column_name(column): column for column in df.columns}
        co_column = (
            normalized_columns.get("co")
            or normalized_columns.get("courseoutcome")
            or normalized_columns.get("gradingindex")
        )
        scale_columns = {
            "VH": normalized_columns.get("vh"),
            "H": normalized_columns.get("h"),
            "M": normalized_columns.get("m"),
            "L": normalized_columns.get("l"),
            "VL": normalized_columns.get("vl"),
        }

        responses = {}
        for index, row in df.iterrows():
            co_id = str(row.get(co_column, f"CO{index + 1}")).strip().upper() if co_column else f"CO{index + 1}"
            if not co_id.startswith("CO"):
                continue
            responses[co_id] = {}
            for label, column in scale_columns.items():
                responses[co_id][label] = float(row.get(column, 0) or 0) if column else 0

        return JsonResponse(
            {
                "success": True,
                "message": f"{len(responses)} course outcome survey rows imported",
                "indirectSurvey": {
                    "scale": {"VH": 5, "H": 4, "M": 3, "L": 2, "VL": 1},
                    "responses": responses,
                },
                "columns": list(df.columns.astype(str)),
            }
        )
    except Exception as error:
        return JsonResponse({"success": False, "message": str(error)}, status=500)


@jwt_required
@csrf_exempt
def upload_excel(request):

    if request.method == "POST":

        try:

            uploaded_file = request.FILES.get("file")

            if not uploaded_file:
                return JsonResponse({
                    "success": False,
                    "message": "No file uploaded"
                })

            if uploaded_file.name.lower().endswith(".xlsx"):
                uploaded_file.seek(0)
                report = parse_accreditation_workbook(uploaded_file)
                return JsonResponse({
                    "success": True,
                    "message": "Accreditation workbook processed successfully",
                    "report": report,
                })

            df = read_uploaded_table(uploaded_file)

            return JsonResponse({

                "success": True,

                "message": "File uploaded successfully",

                "columns": list(df.columns.astype(str)),

                "rows": len(df),

                "preview": df.head(5).fillna("").to_dict(
                    orient="records"
                )

            })

        except Exception as e:

            return JsonResponse({

                "success": False,

                "message": str(e)

            }, status=500)

    return JsonResponse({
        "message": "Upload endpoint ready"
    })
