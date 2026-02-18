# Sistema de Gerenciamento de SLA v2.0

Sistema completo e robusto de Service Level Agreement (SLA) para gerenciamento de chamados com cálculo automático de horas úteis, pausas por status e suporte a feriados móveis brasileiros.

## 🎯 Características Principais

✅ **Cálculo de Horas Úteis**: Considera apenas horário comercial (08:00-18:00) e dias úteis (seg-sex)  
✅ **Feriados Inteligentes**: Suporta feriados fixos e móveis (Páscoa, Carnaval, Corpus Christi, etc)  
✅ **Pausas Automáticas**: Pausa SLA automaticamente em status "Aguardando" e "Em análise"  
✅ **Pausas Manuais**: Permite pausar manualmente e registrar motivo  
✅ **Métricas Detalhadas**: Dashboard com métricas por prioridade, alertas e análises  
✅ **Status de Resposta e Resolução**: Calcula separadamente tempo de primeira resposta e resolução  
✅ **Indicadores de Risco**: Identifica chamados em risco (80%+ do SLA consumido) e vencidos  
✅ **Cache Inteligente**: Implementa cache de feriados e horários para melhor performance

## 📋 Status do Chamado e SLA

| Status             | SLA           | Descrição                                  |
| ------------------ | ------------- | ------------------------------------------ |
| **Aberto**         | ✅ Conta      | SLA em andamento durante horário comercial |
| **Em atendimento** | ✅ Conta      | SLA em andamento                           |
| **Aguardando**     | ⏸️ Pausa      | SLA pausado automaticamente                |
| **Em análise**     | ⏸️ Pausa      | SLA pausado automaticamente                |
| **Concluído**      | ⏹️ Finalizado | SLA encerrado, tempo é calculado           |
| **Cancelado**      | ⏹️ Finalizado | SLA encerrado, tempo é calculado           |

## 🏗️ Arquitetura

```
backend/modules/sla/
├── __init__.py              # Exports do módulo
├── models.py                # Modelos SQLAlchemy
├── schemas.py               # Schemas Pydantic para API
├── calculator.py            # Lógica de cálculo de SLA
├── metrics.py               # Serviço de métricas
├── holidays.py              # Utilitário de feriados
├── routes.py                # Endpoints FastAPI
└── README.md               # Esta documentação
```

## 📦 Instalação e Configuração

### 1. Dependências

Adicione ao `requirements.txt`:

```
fastapi>=0.104.0
sqlalchemy>=2.0.0
pydantic>=2.5.0
python-dateutil>=2.8.2
```

Instale a dependência para cálculo de Páscoa:

```bash
pip install python-dateutil
```

### 2. Integração com FastAPI

```python
# Em seu main.py ou app.py
from backend.modules.sla import router as sla_router

app.include_router(sla_router, prefix="/api")

# Será exposto em /api/sla/*
```

### 3. Migração de Banco de Dados

Execute a migração para criar as tabelas:

```bash
alembic upgrade head
```

## 🚀 Uso

### Python - Cálculo de SLA

```python
from sqlalchemy.orm import Session
from backend.modules.sla.calculator import CalculadorSLA
from backend.modules.sla.models import Chamado

def calcular_sla_chamado(db: Session, chamado_id: int):
    chamado = db.query(Chamado).filter(Chamado.id == chamado_id).first()

    calculator = CalculadorSLA(db)
    resultado = calculator.calcular_sla(chamado)

    print(f"Tempo de resposta: {resultado['tempo_resposta_decorrido_horas']:.2f}h")
    print(f"Percentual consumido: {resultado['percentual_resolucao']}%")
    print(f"Status: {'Vencido' if resultado['resolucao_vencida'] else 'Ok'}")

    return resultado
```

### Python - Métricas

```python
from backend.modules.sla.metrics import ServicoMetricasSLA

def obter_dashboard(db: Session):
    servico = ServicoMetricasSLA(db)

    # Métricas gerais (últimos 30 dias)
    metricas = servico.obter_metricas_gerais()

    # Métricas por prioridade
    por_prioridade = servico.obter_metricas_por_prioridade()

    # Chamados em risco
    em_risco = servico.obter_chamados_em_risco()

    # Dashboard completo
    dashboard = servico.obter_dashboard_executivo()

    return dashboard
```

### API REST

#### Criar Configuração de SLA

```bash
POST /api/sla/config
Content-Type: application/json

{
  "prioridade": "Alta",
  "tempo_resposta_horas": 2,
  "tempo_resolucao_horas": 8,
  "percentual_risco": 80,
  "considera_horario_comercial": true,
  "considera_feriados": true,
  "descricao": "Prioridade alta"
}
```

#### Gerar Feriados Automaticamente

```bash
POST /api/sla/feriado/gerar/2026
```

Resposta:

```json
{
  "ano": 2026,
  "total_feriados": 18,
  "inseridos": 18,
  "duplicados": 0,
  "feriados": [...]
}
```

#### Obter SLA de um Chamado

```bash
GET /api/sla/chamado/123
```

Resposta:

```json
{
  "chamado_id": 123,
  "codigo": "CH-001",
  "prioridade": "Alta",
  "status": "Aberto",
  "tempo_resposta_limite_horas": 2,
  "tempo_resposta_decorrido_horas": 1.5,
  "tempo_resposta_pausado_horas": 0.0,
  "percentual_resposta": 75,
  "resposta_status": "em_risco",
  "tempo_resolucao_limite_horas": 8,
  "tempo_resolucao_decorrido_horas": 1.5,
  "tempo_resolucao_pausado_horas": 0.0,
  "percentual_resolucao": 18.75,
  "resolucao_status": "em_dia",
  "pausado_atualmente": false,
  "total_pausas": 0,
  "tempo_total_pausado_horas": 0.0,
  "ultima_atualizacao": "2026-02-09T14:30:00"
}
```

#### Pausar SLA Manualmente

```bash
POST /api/sla/pausa
Content-Type: application/json

{
  "chamado_id": 123,
  "motivo": "Aguardando resposta do cliente",
  "tipo": "manual"
}
```

#### Retomar SLA

```bash
POST /api/sla/pausa/42/retomar
Content-Type: application/json

{
  "motivo_retomada": "Cliente respondeu"
}
```

#### Recalcular SLA em Lote

```bash
POST /api/sla/recalcular
```

Resposta:

```json
{
  "sucesso": true,
  "mensagem": "SLA recalculado com sucesso",
  "total_processados": 250,
  "em_risco": 15,
  "vencidos": 3,
  "pausados": 8,
  "tempo_ms": 2543
}
```

## 📊 Métricas e Indicadores

### Indicadores Principais

- **Tempo de Resposta**: Tempo até primeira resposta do agente
- **Tempo de Resolução**: Tempo total até conclusão do chamado
- **Percentual Consumido**: (Tempo efetivo / Limite) × 100
- **Status em Risco**: ≥ 80% do SLA consumido
- **Status Vencido**: ≥ 100% do SLA consumido

### Exemplo de Cálculo

Chamado aberto segunda-feira 16:00  
Limite de resposta: 2 horas (SLA Alta)  
Primeira resposta: terça-feira 10:00

**Cálculo de horas úteis:**

- Segunda: 16:00-18:00 = 2 horas ✓
- Terça: 08:00-10:00 = 0 horas (ainda não chegou)
- **Total**: 2 horas = SLA atingido no horário limite

## 🗓️ Feriados Brasileiros

### Feriados Fixos

Sempre na mesma data:

- 01/01 - Confraternização Universal
- 21/04 - Tiradentes
- 01/05 - Dia do Trabalho
- 07/09 - Independência do Brasil
- 12/10 - Nossa Senhora Aparecida
- 02/11 - Finados
- 15/11 - Proclamação da República
- 20/11 - Dia da Consciência Negra
- 25/12 - Natal

### Feriados Móveis (Baseados na Páscoa)

Mudam todo ano:

- **Carnaval** (domingo, segunda e terça): 47 dias antes da Páscoa
- **Quarta de Cinzas**: 46 dias antes (até 14h)
- **Sexta-feira Santa**: 2 dias antes da Páscoa
- **Páscoa**: Varia entre 22/março e 25/abril
- **Corpus Christi**: 60 dias depois da Páscoa

**Exemplo - Ano 2026:**

- Páscoa: 05/04
- Carnaval: 16-17/02
- Corpus Christi: 04/06

## ⚙️ Configuração

### Horário Comercial Padrão

```python
# Padrão: 08:00 - 18:00 de segunda a sexta
# Dias: 0=seg, 1=ter, 2=qua, 3=qui, 4=sex, 5=sab, 6=dom

# Configure via API:
POST /api/sla/horario
{
  "dia_semana": 0,
  "hora_inicio": "08:00",
  "hora_fim": "18:00",
  "ativo": true
}
```

### Configurações de SLA por Prioridade

```
Urgente:  2h resposta,  4h resolução (75% risco)
Alta:     2h resposta,  8h resolução (80% risco)
Normal:   4h resposta, 24h resolução (85% risco)
Baixa:    8h resposta, 40h resolução (90% risco)
```

## 🔍 Troubleshooting

### Feriados não aparecem no cálculo

1. Verifique se o feriado está marcado como `ativo = true`
2. Confirme a data está correta
3. Invalide o cache: `calculator.invalidar_cache()`

### SLA não pausando automaticamente

1. Confirme que o status exato está em `STATUS_PAUSA`
2. Verifique se existe pausa ativa do chamado
3. Verifique logs de erro

### Cálculo está lento

1. Use `recalcular_sla()` periodicamente (não em cada request)
2. Implemente cache de resultados (Redis, Memcached)
3. Use índices de banco de dados nas buscas

## 📈 Performance

- **Cache de feriados**: 1 ano por vez
- **Cache de horários**: Até próxima mudança
- **Cálculo em lote**: ~100-200 chamados/segundo
- **Índices**: Criados em campos críticos

## 🔐 Segurança

- ✅ Validação de entrada via Pydantic
- ✅ Proteção contra SQL Injection (SQLAlchemy ORM)
- ✅ Tratamento de exceções robusto
- ✅ Logging detalhado de operações

## 📝 Logs

Configure logging para rastrear operações:

```python
import logging

logging.getLogger("sla.calculator").setLevel(logging.INFO)
logging.getLogger("sla.metrics").setLevel(logging.INFO)
logging.getLogger("sla.holidays").setLevel(logging.DEBUG)
```

## 🤝 Contribuindo

Para melhorias no módulo SLA:

1. Adicione testes unitários
2. Atualize documentação
3. Siga PEP 8
4. Incremente versão em `__init__.py`

## 📞 Suporte

Para dúvidas ou problemas:

- Consulte os logs em `sla.calculator`, `sla.metrics`, `sla.holidays`
- Verifique se as tabelas foram criadas com `SHOW TABLES`
- Teste endpoint `/api/sla/health` para validar API

## 📄 Licença

Parte do projeto portal-evoquefitness
