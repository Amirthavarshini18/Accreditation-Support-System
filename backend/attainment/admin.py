from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    Facultyuser, Faculty, Course, PO, CO, COPOMapping,
    Assessment, Question, Student, StudentMark, COAttainment, ExcelUpload,
)


@admin.register(Facultyuser)
class FacultyUserAdmin(UserAdmin):
    """Admin panel for FacultyUser — uses Django's UserAdmin for safe password handling."""
    list_display  = ('email', 'get_full_name', 'department', 'designation', 'is_active', 'is_staff', 'date_joined')
    list_filter   = ('is_active', 'is_staff', 'department')
    search_fields = ('email', 'first_name', 'last_name', 'department', 'employee_id')
    ordering      = ('email',)

    fieldsets = UserAdmin.fieldsets + (
        ('Faculty Info', {'fields': ('department', 'designation', 'employee_id')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Faculty Info', {'fields': ('email', 'department', 'designation', 'employee_id')}),
    )


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
