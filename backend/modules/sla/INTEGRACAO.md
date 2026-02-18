# Guia de Integração - Módulo SLA v2.0

## 1. Setup Inicial

### 1.1 Instalar Dependências

```bash
pip install fastapi sqlalchemy pydantic python-dateutil apscheduler
```

### 1.2 Adicionar ao main.py / app.py

```python
from fastapi import FastAPI
from sqlalchemy.orm import Session
from backend.modules.sla import router
from backend.modules.sla.routes_otimizadas import router_otimizado
from backend.modules.sla.scheduler import iniciar_scheduler, parar_scheduler
from backend.modules.sla.init_data import inicializar_completo
from seu_projeto.database import SessionLocal, engine

app = FastAPI()

# Incluir routers
app.include_router(router, prefix="/api")
app.include_router(router_otimizado)

# Evento de startup
@app.on_event("startup")
async def startup_event():
    # Inicializar dados padrão (executar uma vez)
    db = SessionLocal()
    try:
        inicializar_completo(db)
    finally:
        db.close()

    # Iniciar scheduler de atualização automática de SLA
    iniciar_scheduler(SessionLocal, update_interval=15)
    print("✅ Scheduler de SLA iniciado (atualiza a cada 15 minutos)")

# Evento de shutdown
@app.on_event("shutdown")
async def shutdown_event():
    parar_scheduler()
    print("⏹️ Scheduler de SLA parado")
```

### 1.3 Implementar get_db() nos routers

```python
# Em backend/modules/sla/routes.py e routes_otimizadas.py
# Adicionar após a linha "def get_db() -> Session:"

from seu_projeto.database import SessionLocal

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## 2. Setup no Frontend

### 2.1 Copiar serviços e hooks

```bash
# Copiar para seu projeto
cp frontend/src/services/slaService.ts seu-projeto/src/services/
cp frontend/src/hooks/useSLA.ts seu-projeto/src/hooks/
cp frontend/src/components/admin/SlaDashboard.tsx seu-projeto/src/components/admin/
```

### 2.2 Configurar variáveis de ambiente

Adicionar ao `.env`:

```bash
REACT_APP_API_URL=http://localhost:8000
```

### 2.3 Instalar dependências do React

```bash
npm install recharts
```

### 2.4 Integrar no painel admin

```tsx
// Em seu-projeto/src/pages/admin/Dashboard.tsx
import SlaDashboard from "@/components/admin/SlaDashboard";

export default function AdminDashboard() {
  return (
    <div>
      {/* Outros componentes */}
      <SlaDashboard />
    </div>
  );
}
```

## 3. Fluxo de Funcionamento

### 3.1 Inicialização (Startup)

```
1. Aplicação inicia
2. Scheduler é criado
3. Primeira atualização de SLA acontece IMEDIATAMENTE
4. Cache é preenchido com dados calculados
5. Scheduler agenda próxima atualização em 15 minutos
```

### 3.2 Atualização Automática (a cada 15 minutos)

```
1. Scheduler dispara job
2. CalculadorSLA.recalcular_todos() é executado
   - Calcula SLA de TODOS os chamados (rápido com otimizações)
   - Atualiza status de pausa automática
3. Métricas são recalculadas para múltiplos períodos (7, 30, 60, 90 dias)
4. Alertas (chamados em risco/vencidos) são atualizados
5. Dashboard executivo é recalculado
6. TUDO é armazenado em CACHE (memória em-processo)
7. Frontend recebe dados instantaneamente
```

### 3.3 Frontend - Auto-refresh

```
1. Dashboard carrega dados do cache (< 1ms)
2. Auto-refresh acontece a cada 15 minutos
5. Usuário clica "Atualizar Agora" (botão manual)
6. POST /api/sla/cache/atualizar
7. Backend recalcula e atualiza cache
8. Frontend exibe novos dados instantaneamente
```

## 4. Arquitetura de Cache

### 4.1 Níveis de Cache

```
┌─────────────────────────────────────────────────┐
│ Frontend (JavaScript)                           │
│ - Cache local do React (state)                  │
│ - Auto-refresh a cada 15 minutos                │
└─────────────────────────────────────────────────┘
            ↓ (requisição HTTP)
┌─────────────────────────────────────────────────┐
│ Backend (FastAPI)                               │
│ - Endpoints otimizados: /api/sla/cache/*        │
│ - Retornam dados do cache em memória (< 1ms)    │
└─────────────────────────────────────────────────┘
            ↓ (se cache vazio)
┌─────────────────────────────────────────────────┐
│ Scheduler (Background Job)                      │
│ - Executa a cada 15 minutos                     │
│ - Recalcula SLA de todos os chamados            │
│ - Atualiza cache com novos dados                │
│ - Toma ~1-3 segundos por 1000 chamados          │
└─────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────┐
│ Banco de Dados (SQLAlchemy)                     │
│ - Lê configurações, feriados, horários           │
│ - Atualiza campos de SLA nos chamados            │
└─────────────────────────────────────────────────┘
```

### 4.2 TTLs (Time To Live)

| Dados                   | TTL    | Descrição                          |
| ----------------------- | ------ | ---------------------------------- |
| Métricas gerais         | 15 min | Recalculadas a cada 15 min         |
| Métricas por prioridade | 15 min | Recalculadas a cada 15 min         |
| Chamados em risco       | 10 min | Atualizado a cada 15 min           |
| Chamados vencidos       | 10 min | Atualizado a cada 15 min           |
| Dashboard               | 15 min | Completo, atualizado a cada 15 min |
| SLA individual          | 5 min  | Sob demanda                        |
| Feriados                | 1 dia  | Mudam raramente                    |
| Configurações           | 1 hora | Mudam raramente                    |

## 5. Otimizações de Performance

### 5.1 Banco de Dados

```python
# Usar índices
CREATE INDEX ix_chamado_sla_em_risco ON chamado(sla_em_risco);
CREATE INDEX ix_chamado_sla_vencido ON chamado(sla_vencido);
CREATE INDEX ix_feriado_data ON sla_feriado(data);
```

### 5.2 Cálculo de SLA

- ✅ Cache de feriados por ano
- ✅ Cache de horários comerciais
- ✅ Cálculo paralelo para múltiplos períodos
- ✅ Batch processing de chamados

### 5.3 API

- ✅ Endpoints retornam dados em cache (< 1ms)
- ✅ Sem query ao banco de dados
- ✅ Sem cálculos pesados no request
- ✅ Timeout: 5 segundos

## 6. Endpoints Disponíveis

### Frontend (Cache Otimizado)

```bash
GET  /api/sla/cache/metricas?periodo_dias=30
GET  /api/sla/cache/metricas/por-prioridade?periodo_dias=30
GET  /api/sla/cache/chamados/em-risco
GET  /api/sla/cache/chamados/vencidos
GET  /api/sla/cache/dashboard
GET  /api/sla/cache/chamado/{id}
GET  /api/sla/cache/status
POST /api/sla/cache/atualizar
POST /api/sla/cache/limpar
```

### Admin (Cálculo Completo)

```bash
POST   /api/sla/config                    # Criar/atualizar config
GET    /api/sla/config                    # Listar configs
POST   /api/sla/feriado                   # Criar feriado
POST   /api/sla/feriado/gerar/{ano}       # Gerar feriados automaticamente
POST   /api/sla/recalcular                # Forçar recálculo
POST   /api/sla/pausa                     # Pausar manualmente
```

## 7. Monitoramento

### 7.1 Logs

```python
import logging

# Debug
logging.getLogger("sla.scheduler").setLevel(logging.DEBUG)
logging.getLogger("sla.cache").setLevel(logging.DEBUG)

# Production
logging.getLogger("sla.scheduler").setLevel(logging.INFO)
logging.getLogger("sla.cache").setLevel(logging.INFO)
```

### 7.2 Status do Scheduler

```bash
# Ver status do scheduler
GET /api/sla/cache/status

# Retorna:
{
  "status": "ativo",
  "tipo_cache": "memória",
  "ttl_padrao_minutos": 15,
  "estatisticas": {
    "hits": 1234,
    "misses": 12,
    "hit_rate": "99.0%",
    "size": 5
  },
  "atualizacao_intervalo_minutos": 15
}
```

## 8. Troubleshooting

### 8.1 Cache não atualiza

```python
# Verificar se scheduler está rodando
from backend.modules.sla.scheduler import get_scheduler
scheduler = get_scheduler()
print(scheduler.get_status())

# Forçar atualização manualmente
POST /api/sla/cache/atualizar
```

### 8.2 SLA não calcula corretamente

```python
# Verificar configurações
GET /api/sla/config

# Verificar feriados
GET /api/sla/feriado

# Verificar horários comerciais
GET /api/sla/horario
```

### 8.3 Performance lenta

```python
# Ver estatísticas de cache
GET /api/sla/cache/status

# Limpar cache
POST /api/sla/cache/limpar

# Aumentar TTL
from backend.modules.sla.cache_service import get_cache_manager
cache = get_cache_manager()
cache.backend.TTL_METRICAS_GERAIS = 1800  # 30 minutos
```

## 9. Exemplo Completo - main.py

```python
from fastapi import FastAPI
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Imports do SLA
from backend.modules.sla import router
from backend.modules.sla.routes_otimizadas import router_otimizado
from backend.modules.sla.scheduler import iniciar_scheduler, parar_scheduler
from backend.modules.sla.init_data import inicializar_completo
from backend.modules.sla.models import Base

# Setup do banco
DATABASE_URL = "mysql+pymysql://user:password@localhost/database"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Criar tabelas
Base.metadata.create_all(bind=engine)

# FastAPI
app = FastAPI(title="API com SLA")

# Routers
app.include_router(router, prefix="/api")
app.include_router(router_otimizado)

# Implementar get_db
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Eventos
@app.on_event("startup")
async def startup():
    # Inicializar dados de SLA (executa uma vez)
    db = SessionLocal()
    try:
        inicializar_completo(db, anos_feriado=(2026, 2027))
    finally:
        db.close()

    # Iniciar scheduler
    iniciar_scheduler(SessionLocal, update_interval=15)
    print("✅ SLA inicializado e scheduler ativo")

@app.on_event("shutdown")
async def shutdown():
    parar_scheduler()
    print("⏹️ Scheduler parado")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## 10. Checklist de Integração

- [ ] Dependências instaladas
- [ ] Router SLA incluído no FastAPI
- [ ] Router Otimizado incluído no FastAPI
- [ ] get_db() implementado
- [ ] Scheduler inicializado no startup
- [ ] Inicialização de dados executada
- [ ] Tabelas criadas no banco de dados
- [ ] Serviço slaService.ts copiado para frontend
- [ ] Hook useSLA.ts copiado para frontend
- [ ] Componente SlaDashboard.tsx copiado para frontend
- [ ] Variável de ambiente REACT_APP_API_URL configurada
- [ ] recharts instalado no frontend
- [ ] Dashboard integrado no painel admin
- [ ] Testado requisição em /api/sla/cache/dashboard
- [ ] Verificado scheduler rodando (logs de inicialização)

## 11. Performance Esperada

- **Tempo de resposta da API**: < 1ms (dados em cache)
- **Atualização automática**: a cada 15 minutos
- **Cálculo de SLA (batch)**: ~1-3 segundos por 1000 chamados
- **Taxa de cache hits**: > 95%
- **Memória utilizada**: ~50-100MB para 10.000 chamados

## 12. Próximos Passos

1. Implementar WebSocket para atualizações em tempo real
2. Adicionar gráficos históricos (últimos 30 dias)
3. Implementar alertas por email/SMS
4. Adicionar relatórios exportáveis (PDF, Excel)
5. Integrar com sistema de notificações
