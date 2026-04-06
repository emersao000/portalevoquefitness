"""Configurações do módulo SLA"""

from typing import List
from dataclasses import dataclass

@dataclass
class SlaSettings:
    """Configurações gerais do SLA"""
    
    # Horário comercial
    BUSINESS_HOUR_START: int = 8          # Hora de início (08:00)
    BUSINESS_HOUR_END: int = 18           # Hora de término (18:00)
    BUSINESS_DAYS: List[int] = None       # Dias úteis (seg-sex): [0,1,2,3,4]
    
    # Cache
    CACHE_TTL_MINUTES: int = 60           # TTL do cache em minutos
    
    # Scheduler
    SCHEDULER_INTERVAL_MINUTES: int = 5   # Intervalo de recálculo
    SCHEDULER_ENABLED: bool = True        # Ativar scheduler
    
    def __post_init__(self):
        if self.BUSINESS_DAYS is None:
            self.BUSINESS_DAYS = [0, 1, 2, 3, 4]  # Segunda a sexta


# Instância global
settings = SlaSettings()


# Status mapeamento
STATUS_SLA_MAPPING = {
    "Aberto": "ativo",              # ✅ Conta
    "Em atendimento": "ativo",        # ✅ Conta  
    "Em análise": "pausado",        # ⏸️ Pausado
    "Concluído": "finalizado",      # ⏹️ Finalizado
    "Expirado": "finalizado",      # ⏹️ Finalizado
}

# Estados que contam para SLA
SLA_COUNTING_STATUSES = ["Aberto", "Em atendimento"]

# Estados que pausam o SLA
SLA_PAUSED_STATUSES = ["Em análise"]

# Estados que finalizam o SLA
SLA_FINISHED_STATUSES = ["Concluído", "Expirado"]
