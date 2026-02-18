#!/bin/bash

# Script para iniciar Frontend e Backend simultaneamente
# Frontend: porta 3005
# Backend: porta 3001

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir com cores
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Trap para capturar Ctrl+C
cleanup() {
    print_info "Encerrando servidores..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        print_info "Encerrando backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        print_info "Encerrando frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    print_success "Servidores encerrados"
    exit 0
}

trap cleanup SIGINT SIGTERM

print_header "Portal Evoque - Dev Environment"

# Validar que estamos na raiz do projeto
if [ ! -f "backend/main.py" ]; then
    print_error "Este script deve ser executado da raiz do projeto"
    echo "Estrutura esperada:"
    echo "  - backend/main.py (backend FastAPI)"
    echo "  - frontend/package.json (frontend React)"
    exit 1
fi

# Validar existência do frontend
if [ ! -d "frontend" ] || [ ! -f "frontend/package.json" ]; then
    print_error "Pasta frontend ou frontend/package.json não encontrada"
    exit 1
fi

# Validar existência do backend
if [ ! -f "backend/main.py" ]; then
    print_error "Arquivo backend/main.py não encontrado"
    exit 1
fi

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    print_info "Arquivo .env não encontrado, criando versão padrão..."
    cat > .env << 'EOF'
# Backend Configuration
VITE_API_BASE=/api
VITE_PROXY_TARGET=http://127.0.0.1:3001

# Frontend port (não utilizada diretamente, apenas referência)
# FRONTEND_PORT=3005

# Backend port
# BACKEND_PORT=3001
EOF
    print_success "Arquivo .env criado"
fi

print_header "Iniciando Backend"
print_info "Porta: 3001"
print_info "Tecnologia: FastAPI + Uvicorn"

# Iniciar backend em background
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 3001 --reload > ../logs-backend.txt 2>&1 &
BACKEND_PID=$!
cd ..

print_success "Backend iniciado (PID: $BACKEND_PID)"
print_info "Logs: tail -f logs-backend.txt"

# Aguardar um pouco para o backend inicializar
sleep 3

print_header "Iniciando Frontend"
print_info "Porta: 3005"
print_info "Tecnologia: React + Vite"

# Iniciar frontend em background
cd frontend
npm run dev > ../logs-frontend.txt 2>&1 &
FRONTEND_PID=$!
cd ..

print_success "Frontend iniciado (PID: $FRONTEND_PID)"
print_info "Logs: tail -f logs-frontend.txt"

# Aguardar um pouco para confirmação
sleep 2

print_header "Status dos Servidores"
print_success "Frontend: http://localhost:3005"
print_success "Backend API: http://localhost:3001"
print_success "Backend Docs: http://localhost:3001/docs"

print_info ""
print_info "Para ver logs em tempo real:"
print_info "  Backend:  tail -f logs-backend.txt"
print_info "  Frontend: tail -f logs-frontend.txt"
print_info ""
print_info "Pressione Ctrl+C para parar ambos os servidores"
print_info ""

# Manter o script rodando
wait $BACKEND_PID $FRONTEND_PID
