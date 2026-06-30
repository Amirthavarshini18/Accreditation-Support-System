from django.test import TestCase

from .services.calculator import DEFAULT_COURSE_DATA, calculate_course_attainment


class CourseAttainmentCalculationTests(TestCase):
    def test_course_attainment_report_contains_co_and_po_scores(self):
        test_data = {
            "course": DEFAULT_COURSE_DATA["course"],
            "cos": DEFAULT_COURSE_DATA["cos"],
            "pos": DEFAULT_COURSE_DATA["pos"],
            "evaluationPolicy": DEFAULT_COURSE_DATA["evaluationPolicy"],
            "mapping": DEFAULT_COURSE_DATA["mapping"],
            "assessments": [
                {
                    "id": "A1",
                    "name": "Test 1",
                    "questions": [
                        {"id": "q1", "co": "CO1", "maxMarks": 10},
                        {"id": "q2", "co": "CO2", "maxMarks": 10},
                        {"id": "q3", "co": "CO3", "maxMarks": 10},
                        {"id": "q4", "co": "CO4", "maxMarks": 10},
                        {"id": "q5", "co": "CO5", "maxMarks": 10},
                    ]
                }
            ],
            "students": [
                {"registerNumber": "S1", "name": "Student 1", "rawMarks": {"q1": 9, "q2": 8, "q3": 9, "q4": 9, "q5": 9}},
                {"registerNumber": "S2", "name": "Student 2", "rawMarks": {"q1": 8, "q2": 9, "q3": 8, "q4": 8, "q5": 8}},
                {"registerNumber": "S3", "name": "Student 3", "rawMarks": {"q1": 9, "q2": 8, "q3": 9, "q4": 9, "q5": 9}},
            ],
            "indirectSurvey": DEFAULT_COURSE_DATA["indirectSurvey"],
        }
        report = calculate_course_attainment(test_data)

        self.assertEqual(report["summary"]["totalStudents"], 3)
        self.assertEqual(len(report["coResults"]), 5)
        self.assertIn("PO1", report["poScores"])
        self.assertGreater(report["coResults"][0]["score"], 0)
        self.assertGreater(report["poScores"]["PO1"], 0)


from attainment.models import SystemSetting
from attainment.views import _validate_domain

class AuthenticationTests(TestCase):
    def setUp(self):
        SystemSetting.objects.all().delete()
        SystemSetting.objects.create(key='allowed_email_domain', value='nitc.ac.in')
        SystemSetting.objects.create(key='institution_name', value='NIT Calicut')

    def test_domain_validation(self):
        # Allowed
        self.assertIsNone(_validate_domain("faculty.cse@nitc.ac.in"))
        self.assertIsNone(_validate_domain("abc@nitc.ac.in"))
        
        # Rejected
        self.assertIsNotNone(_validate_domain("faculty@nitc.com"))
        self.assertIsNotNone(_validate_domain("student@gmail.com"))
        self.assertIn("Only NIT Calicut institutional email addresses (@nitc.ac.in) are permitted.", _validate_domain("abc@gmail.com"))

    def test_auth_config_endpoint(self):
        response = self.client.get('/api/auth/config/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['allowedDomain'], 'nitc.ac.in')
        self.assertEqual(data['institutionName'], 'NIT Calicut')

    def test_dynamic_domain_config(self):
        # Change domain dynamically in database
        SystemSetting.objects.filter(key='allowed_email_domain').update(value='nitk.edu.in')
        SystemSetting.objects.filter(key='institution_name').update(value='NIT Surathkal')

        self.assertIsNone(_validate_domain("faculty@nitk.edu.in"))
        self.assertIsNotNone(_validate_domain("faculty@nitc.ac.in"))

        response = self.client.get('/api/auth/config/')
        data = response.json()
        self.assertEqual(data['allowedDomain'], 'nitk.edu.in')
        self.assertEqual(data['institutionName'], 'NIT Surathkal')

