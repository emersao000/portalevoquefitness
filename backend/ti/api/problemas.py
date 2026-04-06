from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.db import get_db, engine
from ti.schemas.problema import ProblemaCreate, ProblemaUpdate, ProblemaOut

router = APIRouter(prefix="/problemas", tags=["TI - Problemas"])

@router.get("", response_model=list[ProblemaOut])
def listar_problemas(db: Session = Depends(get_db)):
    from ..models import Problema, Chamado
    try:
        try:
            Problema.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        result = []

        # 1) Try legacy table "problema_reportado" - PRIORIDADE: Tabela principal com a estrutura correcta
        # Estrutura confirmada: id, nome (unique), prioridade_padrao, requer_item_internet, ativo, session_revoked_at, tempo_resolucao_horas
        legacy_queries = [
            # Sem filtro de ativo (inclui tudo)
            "SELECT id, nome, COALESCE(prioridade_padrao, 'Normal') as prioridade, COALESCE(requer_item_internet, 0) as requer_internet, tempo_resolucao_horas FROM problema_reportado ORDER BY nome",
            # Com filtro de ativo (somente ativos)
            "SELECT id, nome, COALESCE(prioridade_padrao, 'Normal') as prioridade, COALESCE(requer_item_internet, 0) as requer_internet, tempo_resolucao_horas FROM problema_reportado WHERE ativo = 1 ORDER BY nome",
            # Sem order by, sem filtro
            "SELECT id, nome, prioridade_padrao, requer_item_internet, tempo_resolucao_horas FROM problema_reportado",
            # Sem order by, com filtro
            "SELECT id, nome, prioridade_padrao, requer_item_internet, tempo_resolucao_horas FROM problema_reportado WHERE ativo = 1 OR ativo IS NULL",
        ]

        for sql in legacy_queries:
            try:
                res = db.execute(text(sql))
                fetched = res.fetchall()
                if fetched and len(fetched) > 0:
                    print(f"✅ Problema-reportado query succeeded: {sql[:80]}")
                    return [
                        {
                            "id": int(r[0]) if r[0] is not None else 0,
                            "nome": str(r[1]).strip() if r[1] else "Sem nome",
                            "prioridade": str(r[2] or "Normal").strip(),
                            "requer_internet": bool(r[3]) if len(r) > 3 else False,
                            "tempo_resolucao_horas": int(r[4]) if len(r) > 4 and r[4] else None,
                        }
                        for r in fetched
                    ]
            except Exception as e:
                print(f"⚠️  Query failed: {sql[:80]} - Error: {e}")
                continue

        print("⚠️  No results from problema_reportado, trying other tables...")

        # 2) Try ORM standard "problema" table
        try:
            rows = db.query(Problema).order_by(Problema.nome.asc()).all()
            if rows:
                print(f"✅ Found {len(rows)} problems in ORM Problema table")
                return [
                    {
                        "id": r.id,
                        "nome": r.nome,
                        "prioridade": r.prioridade,
                        "requer_internet": bool(r.requer_internet),
                    }
                    for r in rows
                ]
        except Exception as e:
            print(f"⚠️  ORM query failed: {e}")
            pass

        # 3) Try "problemas" table (plural) with various column combinations
        fallback_queries = [
            "SELECT id, nome, prioridade, requer_internet, tempo_resolucao_horas FROM problemas",
            "SELECT id, nome, prioridade_padrao, requer_item_internet, tempo_resolucao_horas FROM problemas",
            "SELECT id, problema AS nome, prioridade, requer_internet, tempo_resolucao_horas FROM problemas",
        ]

        for sql in fallback_queries:
            try:
                res = db.execute(text(sql))
                fetched = res.fetchall()
                if fetched:
                    print(f"✅ Found problems in alternate table: {sql[:80]}")
                    return [
                        {
                            "id": int(r[0]) if r[0] is not None else 0,
                            "nome": str(r[1]),
                            "prioridade": str(r[2] or "Normal"),
                            "requer_internet": bool(r[3]) if len(r) > 3 else False,
                            "tempo_resolucao_horas": int(r[4]) if len(r) > 4 and r[4] else None,
                        }
                        for r in fetched
                    ]
            except Exception as e:
                print(f"⚠️  Fallback query failed: {e}")
                continue

        # 4) Last resort: extract problems from existing chamados
        try:
            existing_names = {r[0] for r in db.query(Chamado.problema).distinct().all() if r[0]}
            if existing_names:
                print(f"✅ Extracting {len(existing_names)} problems from existing chamados")
                return [
                    {
                        "id": idx,
                        "nome": nome,
                        "prioridade": "Normal",
                        "requer_internet": nome.lower() == "internet",
                        "tempo_resolucao_horas": None,
                    }
                    for idx, nome in enumerate(sorted(existing_names), 1)
                ]
        except Exception as e:
            print(f"⚠️  Could not extract from chamados: {e}")
            pass

        # If all else fails, return empty list
        print("❌ No problems found anywhere")
        return []

    except Exception as e:
        print(f"❌ Error in listar_problemas: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao listar problemas: {e}")

@router.post("", response_model=ProblemaOut)
def criar_problema(payload: ProblemaCreate, db: Session = Depends(get_db)):
    try:
        from ..models import Problema
        Problema.__table__.create(bind=engine, checkfirst=True)
        from ti.services.problemas import criar_problema as service_criar
        return service_criar(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar problema: {e}")

@router.patch("/{problema_id}", response_model=ProblemaOut)
def atualizar_problema(problema_id: int, payload: ProblemaUpdate, db: Session = Depends(get_db)):
    try:
        print(f"✅ PATCH recebido para ID {problema_id}: {payload.model_dump()}")
        from ti.services.problemas import atualizar_problema as service_atualizar
        result = service_atualizar(db, problema_id, payload)
        print(f"✅ Resultado da atualização: {result}")
        return result
    except ValueError as e:
        print(f"❌ ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar problema: {e}")

@router.delete("/{problema_id}")
def deletar_problema(problema_id: int, db: Session = Depends(get_db)):
    try:
        from ti.services.problemas import deletar_problema as service_deletar
        result = service_deletar(db, problema_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao deletar problema: {e}")
