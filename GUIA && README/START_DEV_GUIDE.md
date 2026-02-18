# Como Iniciar Frontend e Backend

Este projeto inclui scripts para iniciar frontend e backend simultaneamente.

## Requisitos

- **Frontend**: Node.js instalado (npm)
- **Backend**: Python 3.8+ instalado

## Opção 1: Linux/macOS (Recomendado)

### Passo 1: Dar permissão de execução ao script

```bash
chmod +x start-dev.sh
```

### Passo 2: Executar o script
ccccccc
```bash
./start-dev.sh
```

### Passo 3: Acessar a aplicação

- **Frontend**: http://localhost:3005
- **Backend API**: http://localhost:3001
- **Backend Docs**: http://localhost:3001/docs

### Parar os servidores

Pressione `Ctrl+C` no terminal onde executou o script. Ambos os servidores serão encerrados automaticamente.

---

## Opção 2: Windows

### Passo 1: Clicar duplo no script

Execute o arquivo `start-dev.bat` diretamente do Windows Explorer, ou abra o Prompt de Comando e execute:

```cmd
start-dev.bat
```

### Passo 2: Janelas separadas

O script abrirá duas janelas do terminal:

- Uma para o **Backend** (porta 3001)
- Uma para o **Frontend** (porta 3005)

### Passo 3: Acessar a aplicação

- **Frontend**: http://localhost:3005
- **Backend API**: http://localhost:3001
- **Backend Docs**: http://localhost:3001/docs

### Parar os servidores

Feche as janelas do terminal ou pressione `Ctrl+C` em cada uma.

---

## Opção 3: Iniciar Manualmente

Se os scripts não funcionarem, você pode iniciar manualmente:

### Terminal 1 - Backend

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 3001 --reload
```

### Terminal 2 - Frontend

```bash
cd frontend
npm install  # (se não tiver feito ainda)
npm run dev
```

---

## Configurações

### Variáveis de Ambiente

Um arquivo `.env` será criado automaticamente com as configurações padrão:

```env
VITE_API_BASE=/api
VITE_PROXY_TARGET=http://127.0.0.1:3001
```

Se você precisar customizar:

- Edite o arquivo `.env` na raiz do projeto
- Reinicie os servidores

---

## Troubleshooting

### Porta já em uso

Se receber erro de porta em uso:

```
Address already in use
```

**Solução**: Mude a porta nos scripts ou mate o processo usando a porta:

**Linux/macOS**:

```bash
lsof -ti:3001 | xargs kill -9  # Backend
lsof -ti:3005 | xargs kill -9  # Frontend
```

**Windows**:

```cmd
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Backend não inicializa

Verifique se está na pasta correta:

```bash
cd backend
pip install -r requirements.txt  # Instalar dependências se necessário
```

### Frontend não inicializa

Verifique as dependências:

```bash
cd frontend
npm install  # Reinstalar packages
```

### Logs

Os scripts de terminal exibem logs em tempo real. Se os scripts não funcionarem, rode manualmente para ver os logs detalhados.

---

## Estrutura do Projeto

```
.
├── start-dev.sh          # Script Linux/macOS
├── start-dev.bat         # Script Windows
├── START_DEV_GUIDE.md    # Este arquivo
├── frontend/
│   ├── package.json
│   └── src/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── ...
└── ...
```

---

## Proxies e Roteamento

O frontend está configurado para rotear requisições `/api` para o backend:

- Requisição do frontend: `http://localhost:3005`
- Proxy de API: `/api` → `http://localhost:3001`

Você pode customizar isso em `frontend/vite.config.ts` se necessário.
