from fastapi import APIRouter, HTTPException
from typing import Optional
from core.email_msgraph import _get_graph_token, send_mail

router = APIRouter(prefix="/debug", tags=["Debug"])

@router.get("/send-test-email")
def send_test_email(to: Optional[str] = None):
    if not to:
        raise HTTPException(status_code=400, detail="Informe o parâmetro 'to' com o e-mail de destino")
    token = _get_graph_token()
    if not token:
        return {"ok": False, "reason": "no_token"}
    subject = "[Evoque TI] Teste de e-mail"
    body = "<p>Este é um e-mail de teste enviado pela API do Evoque TI.</p>"
    res = send_mail(subject, body, to=[to])
    return {"ok": bool(res)}
