"""Cria índices de performance no banco de dados"""
from core.db import engine
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)

INDICES = [
    "CREATE INDEX IF NOT EXISTS ix_chamado_status ON chamado(status)",
    "CREATE INDEX IF NOT EXISTS ix_chamado_data_abertura ON chamado(data_abertura)",
    "CREATE INDEX IF NOT EXISTS ix_chamado_deletado_em ON chamado(deletado_em)",
    "CREATE INDEX IF NOT EXISTS ix_chamado_prioridade ON chamado(prioridade)",
    "CREATE INDEX IF NOT EXISTS ix_chamado_data_conclusao ON chamado(data_conclusao)",
    "CREATE INDEX IF NOT EXISTS ix_chamado_data_primeira_resposta ON chamado(data_primeira_resposta)",
    "CREATE INDEX IF NOT EXISTS ix_historico_status_chamado_id ON historico_status(chamado_id)",
    "CREATE INDEX IF NOT EXISTS ix_historico_status_data_inicio ON historico_status(data_inicio)",
    "CREATE INDEX IF NOT EXISTS ix_sla_pausa_chamado_id ON sla_pausa(chamado_id)",
]

def create_indices():
    try:
        with engine.connect() as conn:
            for sql in INDICES:
                try:
                    conn.execute(text(sql))
                except Exception:
                    pass  # Índice já existe ou tabela não existe ainda
            conn.commit()
        print("✅ Índices de performance verificados/criados")
    except Exception as e:
        logger.warning(f"Aviso ao criar índices: {e}")
