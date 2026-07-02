from django.urls import path
from .views import (
    auth_config,
    compute_attainment,
    faculty_login,
    faculty_logout,
    faculty_profile,
    faculty_register,
    google_login,
    google_auth_api,
    sample_data,
    token_refresh,
    upload_excel,
    upload_indirect_survey,
    upload_students,
)

urlpatterns = [
    # Auth
    path('auth/config/',   auth_config),
    path('auth/register/', faculty_register),
    path('auth/login/',    faculty_login),
    path('auth/google-login/', google_login),
    path('auth/google/',   google_auth_api),
    path('auth/refresh/',  token_refresh),
    path('auth/logout/',   faculty_logout),
    path('auth/profile/',  faculty_profile),

    # Protected
    path('sample-data/',           sample_data),
    path('compute/',               compute_attainment),
    path('upload/students/',       upload_students),
    path('upload/indirect-survey/', upload_indirect_survey),
    path('upload/',                upload_excel),
]
