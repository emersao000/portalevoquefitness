from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.db import get_db, engine
from ti.schemas.unidade import UnidadeCreate, UnidadeOut

router = APIRouter(prefix="/unidades", tags=["TI - Unidades"])

@router.get("", response_model=list[UnidadeOut])
def listar_unidades(db: Session = Depends(get_db)):
    from ..models import Unidade, Chamado
    try:
        try:
            Unidade.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        # Tenta esquemas legados/plurais com e sem coluna cidade
        queries = [
            "SELECT id, nome, cidade FROM unidade ORDER BY nome",
            "SELECT id, nome FROM unidade ORDER BY nome",
            "SELECT id, unidade AS nome, cidade FROM unidade ORDER BY nome",
            "SELECT id, unidade AS nome FROM unidade ORDER BY nome",
            "SELECT id, nome, cidade FROM unidades ORDER BY nome",
            "SELECT id, nome FROM unidades ORDER BY nome",
            "SELECT id, unidade AS nome, cidade FROM unidades ORDER BY nome",
            "SELECT id, unidade AS nome FROM unidades ORDER BY nome",
        ]

        for sql in queries:
            try:
                res = db.execute(text(sql))
                fetched = res.fetchall()
                if fetched and len(fetched) > 0:
                    print(f"✅ Unidades query succeeded: {sql[:80]}")
                    out = []
                    for r in fetched:
                        if len(r) >= 3:
                            out.append({
                                "id": r[0] or 0,
                                "nome": str(r[1]).strip() if r[1] else "Sem nome",
                                "cidade": str(r[2]).strip() if r[2] else ""
                            })
                        else:
                            out.append({
                                "id": r[0] or 0,
                                "nome": str(r[1]).strip() if r[1] else "Sem nome",
                                "cidade": ""
                            })
                    return out
            except Exception as e:
                print(f"⚠️  Query failed: {sql[:80]} - Error: {e}")
                continue

        print("⚠️  No results from unidade/unidades tables, trying ORM...")

        # ORM padrão (caso exista classe/tabela com cidade)
        try:
            rows_orm = db.query(Unidade).order_by(Unidade.nome.asc()).all()
            if rows_orm:
                print(f"✅ Found {len(rows_orm)} unidades in ORM")
                return [
                    {
                        "id": r.id,
                        "nome": r.nome,
                        "cidade": getattr(r, "cidade", "") or ""
                    }
                    for r in rows_orm
                ]
        except Exception as e:
            print(f"⚠️  ORM query failed: {e}")
            pass

        # Fallback: derivar de chamados existentes
        print("⚠️  Using fallback: extracting unidades from existing chamados...")
        try:
            distinct = [r[0] for r in db.query(Chamado.unidade).distinct().all() if r[0]]
            if distinct:
                print(f"✅ Extracted {len(distinct)} unique unidades from chamados")
                return [
                    {
                        "id": idx,
                        "nome": str(nome).strip(),
                        "cidade": ""
                    }
                    for idx, nome in enumerate(sorted(distinct), 1)
                ]
        except Exception as e:
            print(f"⚠️  Could not extract from chamados: {e}")

        print("❌ No unidades found anywhere")
        return []

    except Exception as e:
        print(f"❌ Error in listar_unidades: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao listar unidades: {e}")

@router.post("", response_model=UnidadeOut)
def criar_unidade(payload: UnidadeCreate, db: Session = Depends(get_db)):
    try:
        from ..models import Unidade
        try:
            Unidade.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass
        from ti.services.unidades import criar_unidade as service_criar
        return service_criar(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar unidade: {e}")

@router.delete("/{unidade_id}")
def deletar_unidade(unidade_id: int, db: Session = Depends(get_db)):
    try:
        from ti.services.unidades import deletar_unidade as service_deletar
        result = service_deletar(db, unidade_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao deletar unidade: {e}")
