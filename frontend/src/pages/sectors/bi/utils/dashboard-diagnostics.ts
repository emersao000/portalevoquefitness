/**
 * Dashboard Diagnostics Utility
 * Ferramentas para diagnosticar e debugar problemas com dashboards do Power BI
 */

export interface DashboardDiagnostics {
  timestamp: string;
  dashboardTitle: string;
  reportId: string;
  datasetId: string | null;
  tokenStatus: string;
  embedUrlStatus: string;
  errors: string[];
  warnings: string[];
}

class DashboardDiagnosticsCollector {
  private logs: DashboardDiagnostics[] = [];

  recordAttempt(
    dashboardTitle: string,
    reportId: string,
    datasetId: string | null,
    tokenStatus: string,
    embedUrlStatus: string,
    errors: string[] = [],
    warnings: string[] = [],
  ) {
    const diagnostic: DashboardDiagnostics = {
      timestamp: new Date().toISOString(),
      dashboardTitle,
      reportId,
      datasetId,
      tokenStatus,
      embedUrlStatus,
      errors,
      warnings,
    };

    this.logs.push(diagnostic);
    console.group(`[Diagnostics] ${dashboardTitle}`);
    console.log("Timestamp:", diagnostic.timestamp);
    console.log("Report ID:", reportId);
    console.log("Dataset ID:", datasetId);
    console.log("Token Status:", tokenStatus);
    console.log("Embed URL Status:", embedUrlStatus);

    if (errors.length > 0) {
      console.error("Errors:", errors);
    }
    if (warnings.length > 0) {
      console.warn("Warnings:", warnings);
    }
    console.groupEnd();
  }

  exportDiagnostics(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  downloadDiagnostics() {
    const data = this.exportDiagnostics();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clearLogs() {
    this.logs = [];
  }

  getLogs(): DashboardDiagnostics[] {
    return this.logs;
  }
}

export const diagnostics = new DashboardDiagnosticsCollector();

/**
 * Checklist para diagnosticar problemas com dashboards
 */
export const troubleshootingChecklist = {
  database: [
    "✅ Verificar se a tabela powerbi_dashboard existe",
    "✅ Verificar se todos os dashboards têm report_id válido (UUID format)",
    "✅ Verificar se todos os dashboards têm dataset_id válido",
    "✅ Verificar se o campo 'ativo' está true para os dashboards",
  ],
  powerBiService: [
    "✅ Verificar se o Service Principal está configurado",
    "✅ Verificar se o Service Principal tem acesso ao workspace",
    "✅ Verificar se o Service Principal tem permissão de leitura",
    "✅ Testar endpoint /powerbi/debug/workspace-access",
  ],
  frontend: [
    "✅ Abrir DevTools (F12) e ir até a aba Console",
    "✅ Verificar se há erros ao trocar de dashboard",
    "✅ Procurar por mensagens [PowerBI] nos logs",
    "✅ Verificar se o embedUrl começa com https://app.powerbi.com",
  ],
  networkRequests: [
    "✅ Abrir DevTools > Network tab",
    "✅ Procurar requisições para /api/powerbi/embed-token",
    "✅ Verificar se a resposta contém token e embedUrl",
    "✅ Verificar status HTTP (200 é sucesso)",
  ],
};

/**
 * Funções auxiliares para debug
 */
export function logDashboardTransition(
  from: string | null,
  to: string,
  reportId: string,
  datasetId: string | null,
) {
  console.group("[BI Dashboard Transition]");
  console.log("⏰ Time:", new Date().toLocaleTimeString("pt-BR"));
  console.log("🔙 From:", from || "none");
  console.log("➡️ To:", to);
  console.log("📊 Report ID:", reportId);
  console.log("💾 Dataset ID:", datasetId);
  console.groupEnd();
}

export function validateDashboardData(dashboard: any): string[] {
  const errors: string[] = [];

  if (!dashboard) {
    errors.push("Dashboard object is null or undefined");
    return errors;
  }

  if (!dashboard.report_id) {
    errors.push("Missing report_id");
  } else if (!isValidUUID(dashboard.report_id)) {
    errors.push(`Invalid report_id format: ${dashboard.report_id}`);
  }

  if (dashboard.dataset_id && !isValidUUID(dashboard.dataset_id)) {
    errors.push(`Invalid dataset_id format: ${dashboard.dataset_id}`);
  }

  if (!dashboard.title) {
    errors.push("Missing title");
  }

  return errors;
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function printTroubleshootingGuide() {
  console.group("🔍 Dashboard Troubleshooting Guide");
  console.log("Database Checks:");
  troubleshootingChecklist.database.forEach((item) => console.log(item));
  console.log("\nPower BI Service Checks:");
  troubleshootingChecklist.powerBiService.forEach((item) => console.log(item));
  console.log("\nFrontend Checks:");
  troubleshootingChecklist.frontend.forEach((item) => console.log(item));
  console.log("\nNetwork Checks:");
  troubleshootingChecklist.networkRequests.forEach((item) => console.log(item));
  console.groupEnd();
}
