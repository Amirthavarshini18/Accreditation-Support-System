import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import pandas as pd

from .models import Faculty
from .services.calculator import DEFAULT_COURSE_DATA, calculate_course_attainment
from .services.excel_processor import parse_accreditation_workbook, parse_marks_workbook


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
def faculty_login(request):
    if request.method != "POST":
        return JsonResponse({"message": "Faculty login endpoint ready"})

    try:
        payload = json.loads(request.body.decode("utf-8"))
        name = payload.get("name", "").strip() or "Faculty Member"
        email = payload.get("email", "").strip().lower()
        password = payload.get("password", "")

        if not email or not password:
            return JsonResponse(
                {"success": False, "message": "Email and password are required"},
                status=400,
            )

        faculty, _ = Faculty.objects.get_or_create(
            email=email,
            defaults={"name": name},
        )

        if faculty.name != name and name != "Faculty Member":
            faculty.name = name
            faculty.save(update_fields=["name"])

        return JsonResponse(
            {
                "success": True,
                "faculty": {
                    "id": faculty.id,
                    "name": faculty.name,
                    "email": faculty.email,
                },
                "message": "Login successful",
            }
        )
    except json.JSONDecodeError:
        return JsonResponse(
            {"success": False, "message": "Invalid JSON payload"},
            status=400,
        )


def sample_data(request):
    return JsonResponse({"success": True, "data": DEFAULT_COURSE_DATA})


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
