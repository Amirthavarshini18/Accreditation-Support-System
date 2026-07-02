"""
Automated fix: clears the broken db state and applies migrations fresh.
Run with the venv Python: venv\Scripts\python.exe fix_db.py
"""
import subprocess, sys, os, shutil

BASE = os.path.dirname(os.path.abspath(__file__))
MIGRATIONS = os.path.join(BASE, 'attainment', 'migrations')

print("=== Step 1: Remove old database ===")
db = os.path.join(BASE, 'db.sqlite3')
if os.path.exists(db):
    os.remove(db)
    print("  Deleted db.sqlite3")
else:
    print("  No db.sqlite3 found")

print("\n=== Step 2: Remove old migration files ===")
for f in os.listdir(MIGRATIONS):
    if f[0].isdigit() and f.endswith('.py'):
        path = os.path.join(MIGRATIONS, f)
        os.remove(path)
        print(f"  Removed {f}")
# Also clear pycache
pycache = os.path.join(MIGRATIONS, '__pycache__')
if os.path.exists(pycache):
    shutil.rmtree(pycache)
    print("  Cleared __pycache__")

print("\n=== Step 3: Create fresh migrations ===")
r = subprocess.run([sys.executable, 'manage.py', 'makemigrations', 'attainment'],
                   capture_output=False)
if r.returncode != 0:
    print("ERROR: makemigrations failed"); sys.exit(1)

print("\n=== Step 4: Apply all migrations ===")
r = subprocess.run([sys.executable, 'manage.py', 'migrate'],
                   capture_output=False)
if r.returncode != 0:
    print("ERROR: migrate failed"); sys.exit(1)

print("\n=== Step 5: Seed default configurations ===")
seed_cmd = (
    "from attainment.models import SystemSetting; "
    "SystemSetting.objects.get_or_create(key='allowed_email_domain', defaults={'value': 'nitc.ac.in'}); "
    "SystemSetting.objects.get_or_create(key='institution_name', defaults={'value': 'NIT Calicut'})"
)
r = subprocess.run([sys.executable, 'manage.py', 'shell', '-c', seed_cmd], capture_output=False)
if r.returncode != 0:
    print("ERROR: seeding failed"); sys.exit(1)

print("\n[OK] All done! Restart the server:")
print("   venv\\Scripts\\python.exe manage.py runserver")