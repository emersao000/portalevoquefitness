# 🔐 Azure Session Authentication Architecture

## Overview

O sistema de autenticação agora usa **2 camadas de segurança**:

1. **Primeira camada (Principal): Azure Database Sessions**
   - Armazenado em: `evoque_fitness.session` (Azure MySQL)
   - Token enviado em: Header `X-Session-Token`
   - Duração: Configurável (padrão 24 horas)
   - Status: Pode ser revogado em tempo real

2. **Segunda camada (Fallback): Auth0 JWT**
   - Armazenado em: sessionStorage do navegador
   - Token enviado em: Header `Authorization: Bearer <token>`
   - Duração: Até 24 horas
   - Usado apenas se a sessão Azure expirar

## Fluxo Completo

```
1. Login do usuário no Admin
   └─> Frontend chama /api/auth/auth0-exchange
       └─> Backend troca código Auth0 por JWT
       └─> Frontend salva email/id em sessionStorage

2. Frontend chama /api/auth/session/create
   └─> Backend cria registro em Azure (session table)
   └─> Retorna session_token
   └─> Frontend salva session_token em sessionStorage

3. Usuario faz ação (ex: atualizar status)
   └─> Frontend envia X-Session-Token no header
   └─> Backend valida contra tabela session no Azure
   ├─> ✅ SE válido e ativo: Usa user_id da sessão
   └─> ⚠️ SE inválido/expirado: Tenta JWT como fallback

4. Backend registra ação
   └─> Armazena em historico_status:
       ├─ usuario_id (do Azure Session)
       ├─ autor_email
       └─ autor_nome
```

## Tabela Session no Azure

```sql
CREATE TABLE session (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  session_token VARCHAR(500) UNIQUE NOT NULL,
  refresh_token VARCHAR(500),
  access_token_expires_at DATETIME NOT NULL,
  refresh_token_expires_at DATETIME,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX user_id (user_id),
  INDEX session_token (session_token),
  INDEX access_token_expires_at (access_token_expires_at),
  FOREIGN KEY (user_id) REFERENCES user(id)
);
```

## Benefícios

✅ **Segurança**
- Sessões podem ser revogadas em tempo real
- IP address e User-Agent armazenados para auditorias
- Todos os acessos rastreados no Azure

✅ **Rastreabilidade**
- Cada ação é registrada com user_id real
- Histórico de quem fez o quê e quando
- Impossível perder informação de usuário

✅ **Controle**
- Admin pode ver sessões ativas
- Pode desconectar usuários manualmente
- Pode revogar acesso sem esperar expiração

✅ **Persistência**
- Não perde sessão ao atualizar F5
- Funciona mesmo se fechar aba (até expiração)
- Recupera se navegador crashear

## Endpoints de Gerenciamento

### Validar Sessão
```bash
POST /api/auth/session/validate
Content-Type: application/json

{
  "session_token": "abc123..."
}

Response: { "is_valid": true }
```

### Revogar Sessão
```bash
POST /api/auth/session/revoke
Content-Type: application/json

{
  "session_token": "abc123..."
}

Response: { "success": true }
```

## Headers HTTP

### Request do Frontend para Backend

```http
X-Session-Token: eyJhbGc... (token da sessão no Azure)
Authorization: Bearer eyJhbGc... (JWT fallback)
Content-Type: application/json
```

### Como é definido em api.ts

```typescript
export function apiFetch(path: string, init?: RequestInit) {
  const sessionToken = sessionStorage.getItem("auth_session_token");
  const headers = new Headers(init?.headers || {});
  
  if (sessionToken) {
    // Envia session token do Azure (principal)
    headers.set("X-Session-Token", sessionToken);
  }
  
  // Fallback JWT não é mais necessário mas mantido para compatibilidade
  
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
```

## Implementação no Backend

```python
def get_current_user_from_request(request: Request, db: Session) -> User | None:
    """
    1. Primeiro valida X-Session-Token contra Azure database
    2. Se inválido, tenta JWT como fallback
    3. Retorna objeto User se válido
    """
    # Estratégia 1: Validar session token contra Azure
    session_token = request.headers.get("X-Session-Token")
    if session_token:
        session = db.query(Session).filter(
            (Session.session_token == session_token) &
            (Session.is_active == True)
        ).first()
        
        if session and not session.is_expired():
            user = db.query(User).filter(User.id == session.user_id).first()
            return user  # ✅ Usuário autenticado via Azure
    
    # Estratégia 2: Fallback para JWT
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
        user_data = verify_auth0_token(token)
        # ... buscar usuário por email
```

## Rastreamento de Ações

Ao atualizar status do chamado:

```python
# Backend extrai usuário da sessão Azure
user = get_current_user_from_request(request, db)

if user:
    # Armazena no histórico
    INSERT INTO historico_status
    (chamado_id, status, usuario_id, autor_email, autor_nome)
    VALUES (123, 'Em atendimento', 45, 'joao@empresa.com', 'João Silva')
```

Result no histórico:
```
Alterado por: João Silva (joao@empresa.com)
IP: 192.168.1.100
Hora: 2026-02-18 10:30:15
```

## Administração de Sessões

Para visualizar/gerenciar sessões (próximo passo):

```sql
-- Ver todas as sessões ativas
SELECT * FROM session WHERE is_active = TRUE;

-- Ver sessões expiradas
SELECT * FROM session WHERE access_token_expires_at < NOW();

-- Revogar sessão específica
UPDATE session SET is_active = FALSE WHERE session_token = 'abc123...';

-- Ver último acesso de um usuário
SELECT MAX(updated_at) FROM session WHERE user_id = 5;
```

## Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Navegador)                 │
│                                                         │
│  sessionStorage:                                        │
│  - auth_session_token (session_token do Azure)         │
│  - evoque-fitness-auth (dados do usuário)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Requisição HTTP
                     │ Header: X-Session-Token: abc123...
                     │
┌────────────────────▼────────────────────────────────────┐
│                  FastAPI Backend                        │
│                                                         │
│  get_current_user_from_request(request, db)            │
│  └─> Extrai X-Session-Token                            │
│  └─> Valida contra tabela session (Azure)              │
│  └─> Retorna User object                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Query ao banco
                     │
┌────────────────────▼────────────────────────────────────┐
│              Azure MySQL Database                       │
│                                                         │
│  Tabela: session                                        │
│  - session_token (buscado)                              │
│  - user_id (obtido)                                     │
│  - is_active (verificado)                               │
│  - access_token_expires_at (validado)                   │
│                                                         │
│  Tabela: user                                           │
│  - id (encontrado via session.user_id)                  │
│  - email, nome, sobrenome                               │
│                                                         │
│  Tabela: historico_status                               │
│  - usuario_id (registrado com user.id)                  │
│  - autor_email (registrado com user.email)              │
│  - autor_nome (registrado com user.nome)                │
└─────────────────────────────────────────────────────────┘
```

## Migração de Código

Se você tinha código usando JWT direto:

### Antes ❌
```python
def endpoint(request: Request, db: Session = Depends(get_db)):
    # Não sabia quem chamou
    # Era apenas um JWT válido
    pass
```

### Depois ✅
```python
def endpoint(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_from_request(request, db)
    if user:
        # Agora sabe exatamente:
        print(f"Usuário: {user.nome}")  # Nome real
        print(f"Email: {user.email}")   # Email real
        print(f"ID: {user.id}")         # ID no banco
        # Pode rastrear tudo no Azure!
    else:
        raise HTTPException(status_code=401)
```

## Segurança

### O que está protegido ✅

1. **Session Token** (X-Session-Token)
   - Gerado por: `secrets.token_urlsafe(32)`
   - Armazenado: Apenas em sessionStorage (nunca em localStorage)
   - Transmitido: Via header HTTP (não em URL)
   - Limpo: Ao fazer logout

2. **Azure Database**
   - Conexão: SSL/TLS
   - Credenciais: Variáveis de ambiente
   - Backup: Automático do Azure

3. **User-Agent + IP**
   - Registrados para detecção de anomalias
   - Podem indicar se sessão foi roubada

### O que não está protegido ❌

- ⚠️ Se o navegador tem malware
- ⚠️ Se o dispositivo foi comprometido
- ⚠️ Se a sessão Azure expirou (mas JWT fallback funciona)

### Recomendações

1. **Implementar HTTPS obrigatório** (já deve estar)
2. **Adicionar rate limiting** em auth endpoints
3. **Implementar 2FA** para contas admin
4. **Monitorar sessões** por IP anômalo
5. **Rotação de secrets** periodicamente

## Próximos Passos

1. ✅ Frontend envia session token
2. ✅ Backend valida contra Azure
3. ✅ Histórico registra usuário real
4. ⏳ **Implementar painel de gerenciamento de sessões**
5. ⏳ **Adicionar alertas de login anômalo**
6. ⏳ **Implementar 2FA**
7. ⏳ **Auditoria de acessos**
