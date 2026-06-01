from django.urls import path
from .views import (
    compute_attainment,
    faculty_login,
    sample_data,
    upload_excel,
    upload_indirect_survey,
    upload_students,
)

urlpatterns = [
    path('auth/login/', faculty_login),
    path('sample-data/', sample_data),
    path('compute/', compute_attainment),
    path('upload/students/', upload_students),
    path('upload/indirect-survey/', upload_indirect_survey),
    path('upload/', upload_excel),
]
