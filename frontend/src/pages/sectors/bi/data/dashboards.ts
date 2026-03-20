export interface Dashboard {
  id: string;
  title: string;
  description: string;
  reportId: string;
  datasetId: string;
  category: string;
}

export interface DashboardCategory {
  id: string;
  name: string;
  dashboards: Dashboard[];
}

const TENANT_ID = "9f45f492-87a3-4214-862d-4c0d080aa136";

export const dashboardsData: DashboardCategory[] = [
  {
    id: "compras",
    name: "Compras",
    dashboards: [
      {
        id: "analise-ocs",
        title: "Análise de OC's",
        description: "Análise detalhada de ordens de compra",
        reportId: "8799e0cf-fe55-4670-8a67-ceeee9744bc4",
        datasetId: "782e2d92-796e-4ed3-9dee-2061acd7fa71",
        category: "compras",
      },
    ],
  },
  {
    id: "sac",
    name: "SAC",
    dashboards: [
      {
        id: "central-relacionamento",
        title: "Central de Relacionamento",
        description: "Gerenciamento de relacionamento com clientes",
        reportId: "837fb0a1-d589-4857-ad9d-44a34fb70b05",
        datasetId: "ce9a2c2a-4d28-469c-8c67-efcab20eef13",
        category: "sac",
      },
    ],
  },
  {
    id: "comercial",
    name: "Comercial",
    dashboards: [
      {
        id: "central-vendas",
        title: "Central de Vendas",
        description: "Dashboard de vendas e performance comercial",
        reportId: "737afc5a-c604-4583-9e71-3f8e81d0f276",
        datasetId: "3e8c451f-c4ee-418f-b6b3-07a091e33883",
        category: "comercial",
      },
      {
        id: "comercial-geral",
        title: "Comercial",
        description: "Análise geral comercial",
        reportId: "0117fd5b-b3c0-46ff-8c1e-c35ff5d4bb8d",
        datasetId: "f94ffdc1-3260-4121-82ea-c0fca16c08a5",
        category: "comercial",
      },
    ],
  },
  {
    id: "unidades",
    name: "Unidades Regionais",
    dashboards: [
      {
        id: "controle-cotas",
        title: "Controle de Cotas",
        description: "Controle e acompanhamento de cotas por unidade",
        reportId: "4bc4c1aa-b8c5-4a8a-b3a2-2417cdfb17c2",
        datasetId: "01df4c2a-0b57-44c2-9423-09e1341cdaf9",
        category: "unidades",
      },
    ],
  },
  {
    id: "contabil",
    name: "Contábil",
    dashboards: [
      {
        id: "fiscal",
        title: "Fiscal",
        description: "Análise de impostos e conformidade fiscal",
        reportId: "34adf0c5-d4ff-49ab-bffd-26eef0df797e",
        datasetId: "ccb7d5c0-35af-482b-b847-8e8ac2a8c9a8",
        category: "contabil",
      },
    ],
  },
  {
    id: "produtos",
    name: "Produtos",
    dashboards: [
      {
        id: "produtos-geral",
        title: "Produtos",
        description: "Gestão e análise de produtos",
        reportId: "74dc6b4a-8b03-4837-881f-37f6b2d8e6a5",
        datasetId: "726ba440-0cf6-4ef8-a4d5-a8e7dd57653a",
        category: "produtos",
      },
    ],
  },
];

export function getPowerBIEmbedUrl(reportId: string): string {
  return `https://app.powerbi.com/reportEmbed?reportId=${reportId}&autoAuth=true&ctid=${TENANT_ID}&navContentPaneEnabled=true&filterPaneEnabled=true`;
}

export function getAllDashboards(): Dashboard[] {
  return dashboardsData.flatMap((category) => category.dashboards);
}

export function getDashboardById(id: string): Dashboard | undefined {
  for (const category of dashboardsData) {
    const dashboard = category.dashboards.find((d) => d.id === id);
    if (dashboard) return dashboard;
  }
  return undefined;
}

export function getCategoryById(id: string): DashboardCategory | undefined {
  return dashboardsData.find((category) => category.id === id);
}
