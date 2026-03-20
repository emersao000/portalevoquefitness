from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.db import get_db
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/grupos", tags=["TI - Grupos de Usuários"])

# ── Schemas ───────────────────────────────────────────────────────────────────

class GrupoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cor: Optional[str] = "#6366f1"
    icone: Optional[str] = "users"
    criado_por: Optional[int] = None

class GrupoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    cor: Optional[str] = None
    icone: Optional[str] = None
    ativo: Optional[int] = None

class MembroAdd(BaseModel):
    user_id: int
    adicionado_por: Optional[int] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_dict(row, keys):
    return {k: v for k, v in zip(keys, row)}

# ── Endpoints: Grupos ─────────────────────────────────────────────────────────

@router.get("")
def listar_grupos(db: Session = Depends(get_db)):
    try:
        sql = text("""
            SELECT
                g.id,
                g.nome,
                g.descricao,
                g.ativo,
                g.data_criacao,
                g.data_atualizacao,
                g.criado_por,
                COUNT(m.id) AS total_membros
            FROM infra.grupos_usuarios g
            LEFT JOIN infra.grupos_usuarios_membros m ON m.grupo_id = g.id
            GROUP BY g.id, g.nome, g.descricao, g.ativo, g.data_criacao, g.data_atualizacao, g.criado_por
            ORDER BY g.nome
        """)
        rows = db.execute(sql).fetchall()
        return [
            {
                "id": r[0],
                "nome": r[1],
                "descricao": r[2],
                "ativo": bool(r[3]),
                "data_criacao": r[4].isoformat() if r[4] else None,
                "data_atualizacao": r[5].isoformat() if r[5] else None,
                "criado_por": r[6],
                "total_membros": int(r[7] or 0),
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar grupos: {e}")


@router.post("")
def criar_grupo(payload: GrupoCreate, db: Session = Depends(get_db)):
    try:
        if payload.criado_por is not None:
            sql = text("""
                INSERT INTO infra.grupos_usuarios (nome, descricao, ativo, criado_por)
                VALUES (:nome, :descricao, 1, :criado_por)
            """)
            params = {"nome": payload.nome, "descricao": payload.descricao, "criado_por": payload.criado_por}
        else:
            sql = text("""
                INSERT INTO infra.grupos_usuarios (nome, descricao, ativo)
                VALUES (:nome, :descricao, 1)
            """)
            params = {"nome": payload.nome, "descricao": payload.descricao}
        result = db.execute(sql, params)
        db.commit()
        new_id = result.lastrowid
        row = db.execute(text("SELECT id, nome, descricao, ativo, data_criacao, data_atualizacao, criado_por FROM infra.grupos_usuarios WHERE id = :id"), {"id": new_id}).fetchone()
        return {
            "id": row[0], "nome": row[1], "descricao": row[2],
            "ativo": bool(row[3]),
            "data_criacao": row[4].isoformat() if row[4] else None,
            "data_atualizacao": row[5].isoformat() if row[5] else None,
            "criado_por": row[6],
            "total_membros": 0,
        }
    except Exception as e:
        db.rollback()
        if "Duplicate entry" in str(e):
            raise HTTPException(status_code=409, detail="Já existe um grupo com esse nome.")
        raise HTTPException(status_code=500, detail=f"Erro ao criar grupo: {e}")


@router.patch("/{grupo_id}")
def atualizar_grupo(grupo_id: int, payload: GrupoUpdate, db: Session = Depends(get_db)):
    try:
        fields = []
        params: dict = {"id": grupo_id}
        if payload.nome is not None:
            fields.append("nome = :nome"); params["nome"] = payload.nome
        if payload.descricao is not None:
            fields.append("descricao = :descricao"); params["descricao"] = payload.descricao
        if payload.ativo is not None:
            fields.append("ativo = :ativo"); params["ativo"] = payload.ativo
        if not fields:
            raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
        fields.append("data_atualizacao = NOW()")
        db.execute(text(f"UPDATE infra.grupos_usuarios SET {', '.join(fields)} WHERE id = :id"), params)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar grupo: {e}")


@router.delete("/{grupo_id}")
def deletar_grupo(grupo_id: int, db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM infra.grupos_usuarios WHERE id = :id"), {"id": grupo_id})
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao deletar grupo: {e}")


# ── Endpoints: Membros ────────────────────────────────────────────────────────

@router.get("/{grupo_id}/membros")
def listar_membros(grupo_id: int, db: Session = Depends(get_db)):
    import logging
    logger = logging.getLogger("grupos")
    try:
        # Busca apenas os IDs dos membros (tabela infra — sem precisar de cross-schema)
        sql = text("""
            SELECT m.id, m.user_id, m.adicionado_em, m.adicionado_por
            FROM infra.grupos_usuarios_membros m
            WHERE m.grupo_id = :grupo_id
        """)
        rows = db.execute(sql, {"grupo_id": grupo_id}).fetchall()

        if not rows:
            return []

        # Busca os dados dos usuários via ORM (usa a conexão padrão com permissão total)
        user_ids = [r[1] for r in rows]
        from ti.models.user import User
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u for u in users}

        result = []
        for r in rows:
            u = user_map.get(r[1])
            result.append({
                "id": r[0],
                "user_id": r[1],
                "adicionado_em": r[2].isoformat() if r[2] else None,
                "adicionado_por": r[3],
                "nome": (u.nome or "") if u else "",
                "sobrenome": (u.sobrenome or "") if u else "",
                "email": (u.email or "") if u else "",
                "usuario": (u.usuario or "") if u else "",
                "nivel_acesso": (u.nivel_acesso or "") if u else "",
            })

        logger.info(f"[GRUPOS] grupo_id={grupo_id} => {len(result)} membros")
        return result
    except Exception as e:
        logger.error(f"[GRUPOS] Erro ao listar membros do grupo {grupo_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar membros: {e}")


@router.post("/{grupo_id}/membros")
def adicionar_membro(grupo_id: int, payload: MembroAdd, db: Session = Depends(get_db)):
    try:
        db.execute(text("""
            INSERT INTO infra.grupos_usuarios_membros (grupo_id, user_id, adicionado_por)
            VALUES (:grupo_id, :user_id, :adicionado_por)
        """), {"grupo_id": grupo_id, "user_id": payload.user_id, "adicionado_por": payload.adicionado_por})
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        if "Duplicate entry" in str(e):
            raise HTTPException(status_code=409, detail="Usuário já está no grupo.")
        raise HTTPException(status_code=500, detail=f"Erro ao adicionar membro: {e}")


@router.delete("/{grupo_id}/membros/{user_id}")
def remover_membro(grupo_id: int, user_id: int, db: Session = Depends(get_db)):
    try:
        db.execute(text("""
            DELETE FROM infra.grupos_usuarios_membros
            WHERE grupo_id = :grupo_id AND user_id = :user_id
        """), {"grupo_id": grupo_id, "user_id": user_id})
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao remover membro: {e}")
