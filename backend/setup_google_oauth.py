import sys
import os

def main():
    print("====================================================")
    print("       Accreditation System - Google OAuth Setup     ")
    print("====================================================")
    client_id = input("\nEnter your Google Client ID:\n> ").strip()
    if not client_id:
        print("Error: Client ID cannot be empty.")
        sys.exit(1)
        
    # Run django code to insert it into the SQLite DB SystemSetting table
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    django.setup()
    
    from attainment.models import SystemSetting
    SystemSetting.objects.update_or_create(
        key='google_client_id',
        defaults={'value': client_id}
    )
    print(f"\n[OK] Success! Google Client ID has been configured in the database.")
    print("You can now refresh the login page on http://localhost:3000/login and use real Google accounts.")

if __name__ == "__main__":
    main()
