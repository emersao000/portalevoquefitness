# 🔍 Debugando Erro 400 do Auth0

## Problema
Ao criar usuário, você está recebendo: `400 Client Error: Bad Request`

## Solução

### 1️⃣ Execute o Script de Teste

No seu backend (notebook), execute:

```bash
cd backend
python test_auth0.py
```

Este script vai:
- ✅ Validar suas credenciais M2M
- ✅ Testar a conexão com Auth0
- ✅ Criar um usuário de teste
- ✅ Deletar o usuário de teste
- ❌ Mostrar exatamente qual é o erro se houver

### 2️⃣ Analise o Output

O script mostrará uma das seguintes situações:

#### ✅ Se PASSOU em tudo:
```
✅ ALL TESTS PASSED! Auth0 M2M is properly configured!
```
→ Suas credenciais M2M estão corretas. O erro 400 pode ser devido a dados específicos do usuário.

#### ❌ Se FALHAR no "Get users":
```
❌ Failed to get users list: ...
This might indicate missing 'read:users' permission
```
→ A app M2M está sem permissão `read:users`. Vá para Auth0 Dashboard e:
1. Applications → Sua app M2M → APIs
2. Selecione "Auth0 Management API"
3. Marque a permissão `read:users`

#### ❌ Se FALHAR no "Create test user":
```
❌ Failed to create test user: ...
```
→ Você está recebendo erro de permissão ou dados inválidos:

**Se o erro incluir "Insufficient scope":**
- A app M2M precisa de `create:users`
- Solução: Auth0 Dashboard → sua app M2M → APIs → Auth0 Management API → marcar `create:users`

**Se o erro incluir "Email already exists":**
- Esse email já foi criado em Auth0
- Solução: Deletar manualmente em Auth0 Dashboard ou usar outro email no teste

**Se o erro incluir "Invalid password":**
- A senha não atende aos requisitos do Auth0
- Solução: Usar senha mais forte (já implementado no código)

---

### 3️⃣ Após Corrigir

Quando o `test_auth0.py` passar com sucesso:

1. **Reinicie o backend**
   ```bash
   # Ctrl+C para parar
   # Depois reinicie
   python -m uvicorn main:app --reload
   ```

2. **Tente criar um usuário novamente** no formulário

3. **Verifique os logs** - você verá:
   ```
   [criar_usuario] 🔄 Starting Auth0 user creation...
   [criar_usuario] ✓ Auth0 client obtained
   [AUTH0-CREATE-USER] 📝 Creating user in Auth0...
   [AUTH0-CREATE-USER] Email: ...
   [AUTH0-CREATE-USER] ✅ User created successfully!
   [AUTH0-CREATE-USER] Auth0 user_id: auth0|xxxxx
   ```

---

## 📋 Checklist de Permissões M2M

Sua app M2M deve ter as seguintes permissões para a **Auth0 Management API**:

- ✅ `create:users` (criar usuários)
- ✅ `read:users` (listar/buscar usuários)
- ✅ `update:users` (atualizar usuários)
- ✅ `delete:users` (deletar usuários - opcional mas útil)

**Como verificar:**
1. Auth0 Dashboard → Applications → Sua app M2M
2. Aba "APIs"
3. Selecione "Auth0 Management API"
4. Veja se as permissões estão marcadas

---

## 🆘 Ainda não funciona?

1. Execute `python test_auth0.py` e copie o output completo
2. Verifique cada permissão no Auth0 Dashboard
3. Verifique se o `AUTH0_M2M_CLIENT_ID` e `AUTH0_M2M_CLIENT_SECRET` estão corretos no `.env`
4. Reinicie o backend após mudanças

---

## 📊 Respostas de Criação do Usuário

Após as alterações, quando você criar um usuário, a resposta inclui:

```json
{
  "id": 1,
  "nome": "Emerson",
  "sobrenome": "Renato",
  "email": "emerson@example.com",
  "usuario": "emersonrenato",
  "nivel_acesso": "ti_admin",
  "setor": "Portal de TI",
  "setores": ["Portal de TI"],
  "bloqueado": false,
  "senha": "aB1cDe",
  "auth0_id": "auth0|507f1f77bcf86cd799439011",     ← Novo campo
  "auth0_created": true                               ← Novo campo
}
```

- ✅ `auth0_created: true` = Usuário foi criado com sucesso no Auth0
- ❌ `auth0_created: false` = Erro ao criar no Auth0, mas criou no banco
- `auth0_id` = ID do usuário no Auth0 (se criado com sucesso)
