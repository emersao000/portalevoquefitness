from __future__ import annotations
import random
import string
from datetime import date
from sqlalchemy.orm import Session
from core.utils import now_brazil_naive
from ti.models import Chamado
from core.db import engine
from ti.schemas.chamado import ChamadoCreate


def _next_codigo(db: Session) -> str:
    """Gera código sequencial no formato EVQ-XXXX (4 dígitos), iniciando em EVQ-0081.
    Apenas considera a tabela atual 'chamado'.
    """
    from ti.models import Chamado
    max_n = 80  # garante mínimo EVQ-0081
    try:
        rows = db.query(Chamado.codigo).filter(Chamado.codigo.like("EVQ-%")).all()
        for (cod,) in rows:
            try:
                suf = str(cod).split("-", 1)[1]
                n = int("".join(ch for ch in suf if ch.isdigit()))
                if n > max_n:
                    max_n = n
            except Exception:
                continue
    except Exception:
        pass
    return f"EVQ-{max_n + 1:04d}"


def _next_protocolo(db: Session) -> str:
    """Gera protocolo ALEATÓRIO no formato XXXXXXXX-X (8 dígitos + hífen + 1 dígito).
    Garante unicidade consultando apenas a tabela atual 'chamado'.
    """
    from ti.models import Chamado

    def gen() -> str:
        base = "".join(str(random.randint(0, 9)) for _ in range(8))
        dv = str(random.randint(0, 9))
        return f"{base}-{dv}"

    for _ in range(50):
        p = gen()
        try:
            exists = db.query(Chamado).filter(Chamado.protocolo == p).first()
        except Exception:
            exists = None
        if not exists:
            return p
    # Fallback muito improvável: usa timestamp truncado + rand
    from time import time
    fallback = f"{int(time())%100000000:08d}-{random.randint(0,9)}"
    return fallback


def criar_chamado(db: Session, payload: ChamadoCreate) -> Chamado:
    try:
        Chamado.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    for _ in range(10):
        codigo = _next_codigo(db)
        protocolo = _next_protocolo(db)
        existe = db.query(Chamado).filter((Chamado.codigo == codigo) | (Chamado.protocolo == protocolo)).first()
        if not existe:
            break
    else:
        raise RuntimeError("Falha ao gerar identificadores do chamado")

    data_visita = None
    if payload.visita:
        data_visita = date.fromisoformat(payload.visita)

    novo = Chamado(
        codigo=codigo,
        protocolo=protocolo,
        solicitante=payload.solicitante,
        cargo=payload.cargo,
        email=str(payload.email),
        telefone=payload.telefone,
        unidade=payload.unidade,
        problema=payload.problema,
        internet_item=payload.internetItem,
        descricao=payload.descricao,
        data_visita=data_visita,
        data_abertura=now_brazil_naive(),
        status="Aberto",
        prioridade="Normal",
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo
