# 🔧 Correções Aplicadas - Power BI Dashboard

## Problema Identificado

Ao trocar de dashboard (ex: Fiscal → Comercial), o código anterior não estava sendo limpo completamente, causando **condições de corrida (race conditions)** e comportamento aleatório.

---

## ✅ Correções Implementadas

### 1. **DashboardViewer.tsx - AbortController (CRÍTICO)**

**Problema:** Requisições antigas continuavam rodando quando você trocava de dashboard

**Solução:**

```typescript
const abortController = new AbortController();
const response = await apiFetch(url, { signal: abortController.signal });
```

**Benefício:** Quando você muda de dashboard, a requisição anterior é **CANCELADA imediatamente**

---

### 2. **DashboardViewer.tsx - Limpeza Completa**

**Problema:** O Power BI Service anterior não estava sendo destruído corretamente

**Solução implementada:**

- ✅ Remover todos os event listeners (`off("loaded")`, `off("error")`, etc)
- ✅ Limpar container HTML completamente (não apenas `innerHTML = ""`)
- ✅ Resetar Power BI Service antes de embutir novo relatório
- ✅ Função `cleanupPreviousEmbed()` dedicada para limpeza

**Benefício:** Zero vazamento de memória entre trocas de dashboard

---

### 3. **DashboardViewer.tsx - Nova Instância do Power BI Service**

**Problema:** Reusava a mesma instância do Power BI Service

**Solução:** Criar **NOVA** instância para cada dashboard

```typescript
const powerBiClient = new pbi.service.Service(
  pbi.factories.hpmFactory,
  pbi.factories.wpmpFactory,
  pbi.factories.routerFactory,
);
```

**Benefício:** Cada dashboard tem seu próprio contexto isolado

---

### 4. **DashboardViewer.tsx - Validação de Dados**

**Problema:** Não validava se o report_id e dataset_id eram válidos

**Solução:** Adicionar validação antes de fazer requisição

```typescript
const validationErrors = validateDashboardData(dashboard);
if (validationErrors.length > 0) {
  throw new Error(validationErrors.join("; "));
}
```

**Benefício:** Erros claros se o dashboard tiver dados inválidos

---

### 5. **DashboardViewer.tsx - Melhor Logging**

**Problema:** Difícil debugar quando as coisas quebravam

**Solução:** Logs estruturados em todas as etapas

- 📊 Carregando dashboard
- ✅ Token recebido
- 🔧 Configuração pronta
- 🎉 Relatório renderizado
- ❌ Erros detalhados

---

### 6. **BiPage.tsx - Logs de Transição**

**Melhoria:** Agora mostra quando você troca de dashboard

```
[BI] 🔄 Trocando dashboard...
[BI] Dashboard anterior: Fiscal
[BI] Novo dashboard: Comercial
[BI] Report ID: 737afc5a...
[BI] Dataset ID: 3e8c451f...
```

---

### 7. **useDashboards.ts - Logs Detalhados**

**Melhoria:** Mostra exatamente quais dashboards foram carregados

```
[BI] 📥 Buscando dashboards do banco de dados...
[BI] ✅ 6 dashboards encontrados
[BI]   - Análise de OC's (analise-ocs)
[BI]     Report: 8799e0cf-fe55...
[BI]     Dataset: 782e2d92-796e...
```

---

### 8. **dashboard-diagnostics.ts - Nova Ferramenta**

**Novo arquivo** para diagnosticar problemas:

```typescript
import {
  diagnostics,
  printTroubleshootingGuide,
} from "./utils/dashboard-diagnostics";

// Abra o console e rode:
printTroubleshootingGuide();

// Ou baixe os dados de diagnóstico:
diagnostics.downloadDiagnostics();
```

---

## 🧪 Como Testar

1. **Abra DevTools** (pressione `F12`)
2. **Vá para a aba Console**
3. **Clique nos dashboards múltiplas vezes rapidamente**
4. Observe os logs:
   - Cada troca mostra exatamente o que está acontecendo
   - Requisições anteriores são canceladas
   - Nenhum erro de "Invalid embed URL"

---

## 📊 Fluxo de Dados Correto Agora

```
Clique em "Fiscal"
     ↓
[BiPage] setSelectedDashboard(fiscal)
     ↓
[DashboardViewer] useEffect dispara (novo dashboard)
     ↓
cleanupPreviousEmbed() - limpa tudo anterior
     ↓
abortController - cancela requisição anterior
     ↓
validateDashboardData() - valida report_id e dataset_id
     ↓
apiFetch com signal - requisição pode ser cancelada
     ↓
Novo Power BI Service criado
     ↓
Token recebido ✅
     ↓
embedUrl validada ✅
     ↓
Relatório carregado ✅

---

Clique em "Comercial" (enquanto Fiscal estava carregando)
     ↓
[BiPage] setSelectedDashboard(comercial)
     ↓
[DashboardViewer] useEffect dispara (novo dashboard)
     ↓
abortController.abort() - requisição de Fiscal é CANCELADA ⏹️
     ↓
cleanupPreviousEmbed() - destroy Fiscal completamente
     ↓
[Reinicia processo para Comercial]
```

---

## 🎯 Resultado Final

✅ **Nenhum mais comportamento aleatório**
✅ **Trocas de dashboard instantâneas e limpas**
✅ **Credenciais corretas carregadas para cada dashboard**
✅ **Logs detalhados para debugging**
✅ **Sem vazamento de memória**

---

## 📝 Próximas Etapas (Opcional)

Se ainda houver problemas:

1. **Verifique o banco de dados:**

   ```sql
   SELECT id, title, report_id, dataset_id, ativo
   FROM powerbi_dashboard
   WHERE ativo = 1;
   ```

2. **Teste o endpoint de debug:**

   ```
   GET /api/powerbi/debug/workspace-access
   ```

3. **Abra DevTools > Console e rode:**
   ```javascript
   import { diagnostics } from "/src/pages/sectors/bi/utils/dashboard-diagnostics.ts";
   console.log(diagnostics.getLogs());
   diagnostics.downloadDiagnostics();
   ```

---

Problema resolvido! 🎉
