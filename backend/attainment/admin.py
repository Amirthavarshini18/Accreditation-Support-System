from django.contrib import admin
from .models import *

admin.site.register(Faculty)
admin.site.register(Course)
admin.site.register(PO)
admin.site.register(CO)
admin.site.register(COPOMapping)

admin.site.register(Assessment)
admin.site.register(Question)

admin.site.register(Student)
admin.site.register(StudentMark)
admin.site.register(COAttainment)
admin.site.register(ExcelUpload)
