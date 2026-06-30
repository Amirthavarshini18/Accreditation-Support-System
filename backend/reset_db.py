"""
Fresh migration reset script.
Run with: venv\Scripts\python.exe reset_db.py
"""
import subprocess
import sys
import os

BASE = os.path.dirname(os.path.abspath(__file__))

# 1. Delete the old SQLite database
db_path = os.path.join(BASE, 'db.sqlite3')
if os.path.exists(db_path):
    os.remove(db_path)
    print(f"Deleted: {db_path}")
else:
    print("No db.sqlite3 found — starting fresh.")

# 2. Delete all migration files except __init__.py
migrations_dir = os.path.join(BASE, 'attainment', 'migrations')
for fname in os.listdir(migrations_dir):
    if fname.startswith('0') and fname.endswith('.py'):
        fpath = os.path.join(migrations_dir, fname)
        os.remove(fpath)
        print(f"Removed migration: {fname}")

# 3. Create fresh migrations
print("\n--- Making migrations ---")
subprocess.run([sys.executable, 'manage.py', 'makemigrations', 'attainment'], check=True)

# 4. Apply all migrations
print("\n--- Applying migrations ---")
subprocess.run([sys.executable, 'manage.py', 'migrate'], check=True)

# 5. Seed default configuration
print("\n--- Seeding default configurations ---")
seed_cmd = (
    "from attainment.models import SystemSetting; "
    "SystemSetting.objects.get_or_create(key='allowed_email_domain', defaults={'value': 'nitc.ac.in'}); "
    "SystemSetting.objects.get_or_create(key='institution_name', defaults={'value': 'NIT Calicut'})"
)
subprocess.run([sys.executable, 'manage.py', 'shell', '-c', seed_cmd], check=True)

print("\n[OK] Done! Database reset, all migrations applied, and default settings seeded.")
print("   Run: venv\\Scripts\\python.exe manage.py createsuperuser")
print("   Then restart: venv\\Scripts\\python.exe manage.py runserver")
