import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'health_records_django_firebase_v2.settings')
application = get_wsgi_application()
