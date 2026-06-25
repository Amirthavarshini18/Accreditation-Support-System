# Generated migration

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attainment', '0006_excelupload'),
    ]

    operations = [
        migrations.AddField(
            model_name='faculty',
            name='password_hash',
            field=models.CharField(max_length=255, default=''),
        ),
        migrations.AlterField(
            model_name='faculty',
            name='email',
            field=models.EmailField(unique=True),
        ),
        migrations.CreateModel(
            name='FacultySession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('course_data', models.JSONField(default=dict)),
                ('report', models.JSONField(null=True, blank=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('faculty', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='session',
                    to='attainment.faculty',
                )),
            ],
        ),
    ]
