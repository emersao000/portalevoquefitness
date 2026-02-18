"""
Módulo SLA
- Horário comercial: 08:00-18:00, seg-sex
- SLA conta: status Aberto e Em atendimento
- SLA pausa: status Aguardando
- Contabiliza apenas chamados >= 16/02/2026
"""
from .router import router
from .metrics import ServicoMetricasSLA
from .service import SlaService

__all__ = ["router", "ServicoMetricasSLA", "SlaService"]
__version__ = "3.0.0"
