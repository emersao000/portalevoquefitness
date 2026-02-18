"""Cria tabela notification_settings"""
from core.db import engine
from ti.models.notification_settings import NotificationSettings

def create_notification_settings_table():
    try:
        NotificationSettings.__table__.create(bind=engine, checkfirst=True)
    except Exception as e:
        print(f"Aviso notification_settings: {e}")
