#!/usr/bin/env python
"""
Script para reiniciar o backend FastAPI
Carrega o .env e inicia o servidor
"""
import sys
import os
import subprocess
from pathlib import Path

# Adicionar o diretório backend ao path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir.parent))

# Carregar variáveis de ambiente
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

print("=" * 60)
print("REINICIANDO BACKEND FASTAPI")
print("=" * 60)

print("\n📋 Variáveis de Ambiente Carregadas:")
print(f"  - POWERBI_CLIENT_ID: {os.getenv('POWERBI_CLIENT_ID', '(não configurado)')[:20]}...")
print(f"  - POWERBI_CLIENT_SECRET: {'✅ Configurado' if os.getenv('POWERBI_CLIENT_SECRET') else '❌ Não configurado'}")
print(f"  - POWERBI_TENANT_ID: {os.getenv('POWERBI_TENANT_ID', '(não configurado)')[:20]}...")

print("\n🚀 Iniciando servidor Uvicorn...")
print("   Acesse: http://localhost:8000")
print("   Debug rotas: http://localhost:8000/api/debug/routes")
print("   Verificar Power BI config: http://localhost:8000/api/powerbi/debug/config")

os.chdir(backend_dir)
try:
    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--host", "127.0.0.1",
        "--port", "8005",
        "--reload"
    ])
except KeyboardInterrupt:
    print("\n\n👋 Backend parado pelo usuário")
    sys.exit(0)
