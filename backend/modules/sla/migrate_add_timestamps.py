"""
Script para adicionar colunas faltantes no banco de dados SLA
"""

from sqlalchemy import text, inspect
from core.db import engine
import logging

logger = logging.getLogger(__name__)


def get_table_columns(table_name: str) -> list:
    """Retorna a lista de colunas de uma tabela"""
    inspector = inspect(engine)
    return [col['name'] for col in inspector.get_columns(table_name)]


def migrate_add_timestamps():
    """Adiciona colunas faltantes nas tabelas SLA"""
    
    with engine.begin() as conn:
        # ===== MIGRAÇÃO: sla_pausas =====
        try:
            columns = get_table_columns("sla_pausas")
            
            # Adicionar criado_em se não existir
            if "criado_em" not in columns:
                print("⚠️  Adicionando coluna 'criado_em' à tabela 'sla_pausas'...")
                conn.execute(text("""
                    ALTER TABLE sla_pausas 
                    ADD COLUMN criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
                """))
                print("✅ Coluna 'criado_em' adicionada com sucesso")
            else:
                print("✓ Coluna 'criado_em' já existe em 'sla_pausas'")
            
            # Adicionar atualizado_em se não existir
            if "atualizado_em" not in columns:
                print("⚠️  Adicionando coluna 'atualizado_em' à tabela 'sla_pausas'...")
                conn.execute(text("""
                    ALTER TABLE sla_pausas 
                    ADD COLUMN atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                """))
                print("✅ Coluna 'atualizado_em' adicionada com sucesso")
            else:
                print("✓ Coluna 'atualizado_em' já existe em 'sla_pausas'")
                
        except Exception as e:
            print(f"❌ Erro ao migrar sla_pausas: {e}")
            raise
        
        # ===== MIGRAÇÃO: sla_calculation_log =====
        try:
            columns = get_table_columns("sla_calculation_log")
            
            # Adicionar chamados_pausados se não existir
            if "chamados_pausados" not in columns:
                print("⚠️  Adicionando coluna 'chamados_pausados' à tabela 'sla_calculation_log'...")
                conn.execute(text("""
                    ALTER TABLE sla_calculation_log 
                    ADD COLUMN chamados_pausados INT DEFAULT 0
                """))
                print("✅ Coluna 'chamados_pausados' adicionada com sucesso")
            else:
                print("✓ Coluna 'chamados_pausados' já existe em 'sla_calculation_log'")
                
        except Exception as e:
            print(f"❌ Erro ao migrar sla_calculation_log: {e}")
            raise


def cleanup_historico_status():
    """Remove tabela temporária de migração de historico_status se existir"""
    
    with engine.begin() as conn:
        try:
            # Verificar e dropar a tabela temporária se existir
            conn.execute(text("DROP TABLE IF EXISTS historico_status_new"))
            print("✓ Tabela temporária 'historico_status_new' removida (se existia)")
        except Exception as e:
            print(f"⚠️  Erro ao limpar historico_status_new: {e}")


if __name__ == "__main__":
    migrate_add_timestamps()
    cleanup_historico_status()
    print("\n✅ Migração concluída com sucesso!")
