from django.test import TestCase

from .services.calculator import DEFAULT_COURSE_DATA, calculate_course_attainment


class CourseAttainmentCalculationTests(TestCase):
    def test_course_attainment_report_contains_co_and_po_scores(self):
        report = calculate_course_attainment(DEFAULT_COURSE_DATA)

        self.assertEqual(report["summary"]["totalStudents"], 3)
        self.assertEqual(len(report["coResults"]), 5)
        self.assertIn("PO1", report["poScores"])
        self.assertGreater(report["coResults"][0]["score"], 0)
        self.assertGreater(report["poScores"]["PO1"], 0)
