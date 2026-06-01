from django.db import models

class Faculty(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()

    def __str__(self):
        return self.name

class Course(models.Model):
    course_name = models.CharField(max_length=200)
    course_code = models.CharField(max_length=20)

    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE)

    semester = models.IntegerField()
    credits = models.IntegerField()

    def __str__(self):
        return self.course_name

class PO(models.Model):
    po_number = models.CharField(max_length=10)
    description = models.TextField()

    def __str__(self):
        return self.po_number

class CO(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)

    co_number = models.CharField(max_length=10)
    description = models.TextField()

    def __str__(self):
        return self.co_number

class COPOMapping(models.Model):
    co = models.ForeignKey(CO, on_delete=models.CASCADE)
    po = models.ForeignKey(PO, on_delete=models.CASCADE)

    mapping_level = models.IntegerField()

    def __str__(self):
        return f"{self.co} - {self.po}"

class Assessment(models.Model):
    assessment_name = models.CharField(max_length=100)

    weightage = models.FloatField()

    def __str__(self):
        return self.assessment_name

class Question(models.Model):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)

    question_text = models.CharField(max_length=200)

    co = models.ForeignKey(CO, on_delete=models.CASCADE)

    max_marks = models.FloatField()

    def __str__(self):
        return self.question_text
    
class Student(models.Model):

    register_number = models.CharField(
        max_length=30,
        unique=True
    )

    student_name = models.CharField(
        max_length=100
    )

    section = models.CharField(
        max_length=20
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE
    )

    def __str__(self):
        return self.student_name
    
class StudentMark(models.Model):

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE
    )

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE
    )

    marks_obtained = models.FloatField()

    def __str__(self):
        return f"{self.student} - {self.question}"
class COAttainment(models.Model):

    co = models.ForeignKey(
        CO,
        on_delete=models.CASCADE
    )

    attainment_percentage = models.FloatField()

    attainment_score = models.FloatField()

    def __str__(self):
        return self.co.co_number
    
class ExcelUpload(models.Model):

    title = models.CharField(max_length=200)

    file = models.FileField(upload_to='uploads/')

    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title