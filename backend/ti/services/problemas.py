from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy import text
from ti.models import Problema
from ti.schemas.problema import ProblemaCreate, ProblemaUpdate


VALID_PRIORIDADES = {"Crítica", "Alta", "Normal", "Baixa"}

def deletar_problema(db: Session, problema_id: int) -> dict:
    """
    Deleta um problema do banco de dados.
    Tenta a tabela legada 'problema_reportado' primeiro, depois a tabela ORM.
    """
    try:
        # Tentar deletar da tabela legada
        res = db.execute(
            text("DELETE FROM problema_reportado WHERE id = :id"),
            {"id": problema_id},
        )
        db.commit()
        if res.rowcount and res.rowcount > 0:
            return {"sucesso": True, "mensagem": f"Problema {problema_id} deletado com sucesso"}
    except Exception as e:
        print(f"⚠️  Erro ao deletar da tabela legada: {e}")
        db.rollback()

    # Fallback: tentar deletar via ORM
    try:
        problema = db.query(Problema).filter(Problema.id == problema_id).first()
        if not problema:
            raise ValueError(f"Problema com ID {problema_id} não encontrado")
        db.delete(problema)
        db.commit()
        return {"sucesso": True, "mensagem": f"Problema {problema_id} deletado com sucesso"}
    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao deletar problema: {e}")

def criar_problema(db: Session, payload: ProblemaCreate) -> Problema:
    nome = (payload.nome or "").strip()
    if not nome:
        raise ValueError("Nome do problema é obrigatório")
    prioridade = (payload.prioridade or "Normal").strip().title()
    if prioridade not in VALID_PRIORIDADES:
        prioridade = "Normal"

    # Uniqueness check in both ORM table and legacy table (case-insensitive)
    existe = db.query(Problema).filter(Problema.nome.ilike(nome)).first()
    if not existe:
        try:
            row = db.execute(
                text("SELECT id FROM problema_reportado WHERE LOWER(nome) = LOWER(:nome) LIMIT 1"),
                {"nome": nome},
            ).first()
            if row is not None:
                existe = True  # type: ignore
        except Exception:
            pass
    if existe:
        raise ValueError("Problema já cadastrado")

    # Prefer writing to legacy table problema_reportado when available
    try:
        res = db.execute(
            text(
                "INSERT INTO problema_reportado (nome, prioridade_padrao, requer_item_internet, ativo, tempo_resolucao_horas) "
                "VALUES (:nome, :prioridade, :requer, 1, :tempo)"
            ),
            {
                "nome": payload.nome,
                "prioridade": payload.prioridade,
                "requer": 1 if payload.requer_internet else 0,
                "tempo": payload.tempo_resolucao_horas,
            },
        )
        db.commit()
        inserted_id = getattr(res, "lastrowid", None)
        if not inserted_id:
            try:
                row = db.execute(
                    text("SELECT id FROM problema_reportado WHERE nome = :nome ORDER BY id DESC LIMIT 1"),
                    {"nome": payload.nome},
                ).first()
                if row is not None:
                    inserted_id = int(row[0])
            except Exception:
                inserted_id = 0
        return Problema(  # return a Problema-like object for response model
            id=inserted_id or 0,  # type: ignore[arg-type]
            nome=nome,
            prioridade=prioridade,
            requer_internet=payload.requer_internet,
            tempo_resolucao_horas=payload.tempo_resolucao_horas,
        )
    except Exception:
        # Fallback to ORM table
        novo = Problema(
            nome=nome,
            prioridade=prioridade,
            requer_internet=payload.requer_internet,
            tempo_resolucao_horas=payload.tempo_resolucao_horas,
        )
        db.add(novo)
        db.commit()
        db.refresh(novo)
        return novo


def atualizar_problema(db: Session, problema_id: int, payload: ProblemaUpdate) -> Problema:
    if not payload.prioridade and payload.tempo_resolucao_horas is None and payload.requer_internet is None:
        raise ValueError("Nenhum campo para atualizar")

    prioridade = None
    if payload.prioridade:
        prioridade = payload.prioridade.strip().title()
        if prioridade not in VALID_PRIORIDADES:
            raise ValueError(f"Prioridade inválida. Opções válidas: {', '.join(VALID_PRIORIDADES)}")

    # Try updating in legacy table primeiro
    try:
        update_fields = []
        params = {"id": problema_id}

        if prioridade:
            update_fields.append("prioridade_padrao = :prioridade")
            params["prioridade"] = prioridade

        if payload.tempo_resolucao_horas is not None:
            update_fields.append("tempo_resolucao_horas = :tempo")
            params["tempo"] = payload.tempo_resolucao_horas

        if payload.requer_internet is not None:
            update_fields.append("requer_item_internet = :requer")
            params["requer"] = 1 if payload.requer_internet else 0

        if update_fields:
            sql = f"UPDATE problema_reportado SET {', '.join(update_fields)} WHERE id = :id"
            res = db.execute(text(sql), params)
            db.commit()

            # Fetch updated record (whether rowcount > 0 or not)
            row = db.execute(
                text("SELECT id, nome, COALESCE(prioridade_padrao, 'Normal') as prioridade, COALESCE(requer_item_internet, 0) as requer_internet, tempo_resolucao_horas FROM problema_reportado WHERE id = :id"),
                {"id": problema_id}
            ).first()

            if row:
                return Problema(
                    id=int(row[0]),
                    nome=str(row[1]),
                    prioridade=str(row[2]),
                    requer_internet=bool(row[3]),
                    tempo_resolucao_horas=int(row[4]) if row[4] else None,
                )
            else:
                # Record doesn't exist in legacy table, try ORM
                raise ValueError("Registro não encontrado na tabela legacy, tentando ORM...")
    except Exception as e:
        print(f"⚠️  Legacy table update failed: {e}")

    # Fallback to ORM table
    try:
        problema = db.query(Problema).filter(Problema.id == problema_id).first()
        if not problema:
            raise ValueError(f"Problema com ID {problema_id} não encontrado")

        if prioridade:
            problema.prioridade = prioridade
        if payload.tempo_resolucao_horas is not None:
            problema.tempo_resolucao_horas = payload.tempo_resolucao_horas
        if payload.requer_internet is not None:
            problema.requer_internet = payload.requer_internet

        db.add(problema)
        db.commit()
        db.refresh(problema)
        return problema
    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao atualizar problema: {e}")
