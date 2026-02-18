# 🔐 Configuração do Auth0 M2M para Criar Usuários

## Problema
A funcionalidade "Criar Usuário" só cria no banco de dados Azure, mas **NÃO cria no Auth0**. Isso acontece porque as credenciais M2M (Machine-to-Machine) do Auth0 não estão configuradas.

## Solução - Passo a Passo

### 1️⃣ Acesse o Auth0 Dashboard

1. Acesse: https://manage.auth0.com
2. Faça login com suas credenciais

### 2️⃣ Crie uma Aplicação Machine-to-Machine (M2M)

1. No menu lateral esquerdo, vá para: **Applications** → **Applications**
2. Clique no botão **Create Application**
3. Escolha o nome: `Portal-User-Management` (ou similar)
4. Selecione o tipo: **Machine to Machine**
5. Clique em **Create**

### 3️⃣ Configure as Permissões (Scopes)

1. Na aba **API** (ou **APIs**), selecione **Auth0 Management API**
2. Expanda as permissões disponíveis e selecione as seguintes:
   - ✅ `create:users` - Para criar novos usuários
   - ✅ `read:users` - Para buscar usuários
   - ✅ `update:users` - Para atualizar usuários
   - ✅ `delete:users` - Para deletar usuários
   - ✅ `read:user_idp_credentials`

3. Clique em **Update** ou **Save**

### 4️⃣ Obtenha as Credenciais

1. Vá para a aba **Credentials** (ou **Settings**)
2. Copie:
   - **Client ID** → Será seu `AUTH0_M2M_CLIENT_ID`
   - **Client Secret** → Será seu `AUTH0_M2M_CLIENT_SECRET`

⚠️ **Importante:** Nunca compartilhe o `Client Secret`!

### 5️⃣ Configure o Arquivo .env do Backend

1. Abra/crie o arquivo `backend/.env`
2. Adicione as variáveis (use o template em `backend/.env.example`):

```env
# Auth0 M2M Credentials (para criar usuários)
AUTH0_M2M_CLIENT_ID=your_m2m_client_id_aqui
AUTH0_M2M_CLIENT_SECRET=your_m2m_client_secret_aqui

# Outras variáveis necessárias:
AUTH0_DOMAIN=evoqueacademia-prd.us.auth0.com
AUTH0_CLIENT_ID=seu_client_id_here
AUTH0_CLIENT_SECRET=seu_client_secret_here
AUTH0_AUDIENCE=https://erp-api.evoquefitness.com.br
```

### 6️⃣ Reinicie o Backend

Após salvar o arquivo `.env`, reinicie o servidor backend:

```bash
# Se estiver usando npm
npm run dev:backend

# Ou diretamente:
cd backend && python -m uvicorn main:app --reload
```

### 7️⃣ Teste a Criação de Usuário

1. Acesse o portal em seu navegador
2. Vá para: **TI** → **Administração** → **Usuários** → **Criar Usuário**
3. Preencha o formulário e clique em **Criar Usuário**
4. Verifique os logs do backend - você deve ver:

```
[criar_usuario] 🔄 Starting Auth0 user creation...
[criar_usuario] Email: usuario@example.com
...
[criar_usuario] ✅ Auth0 user created successfully!
[criar_usuario] Auth0 ID: auth0|xxxxx
```

Se vir ❌ em vez de ✅, os logs mostrarão o erro específico.

---

## ✅ O que deve acontecer após configurar

Quando você criar um usuário através do formulário:

1. ✅ Usuário criado no **Banco de Dados Azure**
2. ✅ Usuário criado no **Auth0**
3. ✅ ID do Auth0 armazenado no banco de dados local
4. ✅ Usuário consegue fazer login através do Auth0

---

## 🔍 Debugando Problemas

### Se o usuário é criado mas Auth0 fica vazio:

#### Opção 1: Verificar Logs
No backend, você verá detalhes do erro. Procure por:
```
[criar_usuario] ❌ FAILED to create Auth0 user
[criar_usuario] Error message: ...
```

#### Opção 2: Verificar as Credenciais M2M
```bash
# No seu notebook/backend, teste:
curl -X POST https://evoqueacademia-prd.us.auth0.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_M2M_CLIENT_ID&client_secret=YOUR_M2M_CLIENT_SECRET&audience=https://evoqueacademia-prd.us.auth0.com/api/v2/&grant_type=client_credentials"
```

Se retornar um `access_token`, as credenciais estão corretas.

#### Opção 3: Verificar Permissões M2M
No Auth0 Dashboard:
1. Vá para **Applications** → Sua app M2M
2. Na aba **APIs**, verifique se `Auth0 Management API` tem `create:users`

---

## 📋 Resumo Rápido

| Variável | Onde obter |
|----------|-----------|
| `AUTH0_M2M_CLIENT_ID` | Auth0 Dashboard → Applications → Sua app M2M → Credentials → Client ID |
| `AUTH0_M2M_CLIENT_SECRET` | Auth0 Dashboard → Applications → Sua app M2M → Credentials → Client Secret |
| `AUTH0_DOMAIN` | Auth0 Dashboard → Settings (topo direito) → Domain |

---

## ❓ Precisa de Ajuda?

Se tiver dúvidas:
1. Verifique os logs do backend
2. Confirme que as variáveis estão no arquivo `.env` (não `.env.example`)
3. Reinicie o backend após mudanças no `.env`
4. Verifique se a app M2M tem permissão `create:users`
