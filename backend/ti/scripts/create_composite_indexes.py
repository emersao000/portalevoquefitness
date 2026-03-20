"""
Cria índices compostos para acelerar as queries mais frequentes.
Executado no startup - ignora erros se os índices já existem.
"""
from core.db import engine
from sqlalchemy import text


INDEXES = [
    # Query admin: WHERE deletado_em IS NULL ORDER BY id DESC LIMIT N
    ("ix_chamado_admin_list",     "CREATE INDEX ix_chamado_admin_list ON chamado (deletado_em, id DESC)"),
    # Query meus chamados: WHERE deletado_em IS NULL AND status_assumido_por_id = X ORDER BY id DESC
    ("ix_chamado_assumido_list",  "CREATE INDEX ix_chamado_assumido_list ON chamado (deletado_em, status_assumido_por_id, id DESC)"),
    # historico_status: query por chamado_id + data
    ("ix_hs_chamado_created",     "CREATE INDEX ix_hs_chamado_created ON historico_status (chamado_id, created_at ASC)"),
]


def create_composite_indexes():
    try:
        with engine.connect() as conn:
            # Descobre índices já existentes
            existing = set()
            try:
                rows = conn.execute(text(
                    "SELECT INDEX_NAME FROM information_schema.STATISTICS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('chamado','historico_status')"
                )).fetchall()
                existing = {r[0] for r in rows}
            except Exception:
                pass

            created = 0
            for idx_name, ddl in INDEXES:
                if idx_name not in existing:
                    try:
                        conn.execute(text(ddl))
                        conn.commit()
                        created += 1
                        print(f"✅ Índice criado: {idx_name}")
                    except Exception as e:
                        if "Duplicate key name" in str(e) or "already exists" in str(e).lower():
                            pass  # já existe
                        else:
                            print(f"⚠️  Índice {idx_name}: {e}")

            if created:
                print(f"✅ {created} índice(s) composto(s) criado(s)")
    except Exception as e:
        print(f"⚠️  create_composite_indexes: {e}")
