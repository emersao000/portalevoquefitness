/**
 * Mapeamento de todas as páginas disponíveis no sistema
 * Usado para configurar em quais páginas os alertas serão exibidos
 */

export const ALERT_PAGES = {
  // Páginas públicas
  home: {
    id: "home",
    label: "Página Inicial",
    path: "/",
    category: "Públicas",
  },
  login: {
    id: "login",
    label: "Página de Login",
    path: "/login",
    category: "Públicas",
  },
  forgotPassword: {
    id: "forgotPassword",
    label: "Recuperar Senha",
    path: "/auth/forgot-password",
    category: "Públicas",
  },
  changePassword: {
    id: "changePassword",
    label: "Alterar Senha",
    path: "/auth/change-password",
    category: "Autenticação",
  },
  resetPasswordSuccess: {
    id: "resetPasswordSuccess",
    label: "Senha Resetada",
    path: "/auth/reset-password-success",
    category: "Autenticação",
  },
  accessDenied: {
    id: "accessDenied",
    label: "Acesso Negado",
    path: "/access-denied",
    category: "Erros",
  },

  // Setores
  sectorTI: {
    id: "sectorTI",
    label: "Portal de TI",
    path: "/setor/ti",
    category: "Setores",
  },
  sectorBI: {
    id: "sectorBI",
    label: "Portal de bi",
    path: "/setor/bi",
    category: "Setores",
  },
  sectorFinanceiro: {
    id: "sectorFinanceiro",
    label: "Portal Financeiro",
    path: "/setor/financeiro",
    category: "Setores",
  },
  sectorManutencao: {
    id: "sectorManutencao",
    label: "Portal de Manutenção",
    path: "/setor/manutencao",
    category: "Setores",
  },
  sectorMarketing: {
    id: "sectorMarketing",
    label: "Setor de marketing",
    path: "/setor/marketing",
    category: "Setores",
  },
  sectorProdutos: {
    id: "sectorProdutos",
    label: "Setor de produtos",
    path: "/setor/produtos",
    category: "Setores",
  },
  sectorComercial: {
    id: "sectorComercial",
    label: "Setor comercial",
    path: "/setor/comercial",
    category: "Setores",
  },
  sectorOutrosServicos: {
    id: "sectorOutrosServicos",
    label: "Outros Serviços",
    path: "/setor/outros-servicos",
    category: "Setores",
  },

  // Admin - TI
  tiAdminOverview: {
    id: "tiAdminOverview",
    label: "Dashboard Admin TI",
    path: "/setor/ti/admin/overview",
    category: "Admin TI",
  },
  tiAdminChamados: {
    id: "tiAdminChamados",
    label: "Gestão de Chamados",
    path: "/setor/ti/admin/chamados",
    category: "Admin TI",
  },
  tiAdminUsuarios: {
    id: "tiAdminUsuarios",
    label: "Gestão de Usuários",
    path: "/setor/ti/admin/usuarios",
    category: "Admin TI",
  },
  tiAdminMonitoramento: {
    id: "tiAdminMonitoramento",
    label: "Monitoramento",
    path: "/setor/ti/admin/monitoramento",
    category: "Admin TI",
  },
  tiAdminHistorico: {
    id: "tiAdminHistorico",
    label: "Histórico",
    path: "/setor/ti/admin/historico",
    category: "Admin TI",
  },
  tiAdminIntegracoes: {
    id: "tiAdminIntegracoes",
    label: "Integrações",
    path: "/setor/ti/admin/integracoes",
    category: "Admin TI",
  },
  tiAdminConfiguracoes: {
    id: "tiAdminConfiguracoes",
    label: "Configurações",
    path: "/setor/ti/admin/configuracoes",
    category: "Admin TI",
  },
  tiAdminAlertas: {
    id: "tiAdminAlertas",
    label: "Alertas",
    path: "/setor/ti/admin/configuracoes/alertas",
    category: "Admin TI",
  },

  // Páginas adicionais de setores
  notFound: {
    id: "notFound",
    label: "Página não encontrada",
    path: "/404",
    category: "Erros",
  },
} as const;

export type AlertPageId = keyof typeof ALERT_PAGES;

/**
 * Agrupa páginas por categoria
 */
export const groupPagesByCategory = () => {
  const grouped = Object.values(ALERT_PAGES).reduce(
    (acc, page) => {
      if (!acc[page.category]) {
        acc[page.category] = [];
      }
      acc[page.category].push(page);
      return acc;
    },
    {} as Record<string, (typeof ALERT_PAGES)[AlertPageId][]>,
  );

  return grouped;
};

/**
 * Verifica se a página atual deve mostrar um alerta
 */
export const shouldShowAlertOnPage = (
  alertPages: string[] | null | undefined,
  currentPath: string,
): boolean => {
  // Se não houver páginas configuradas, mostrar em todas
  if (!alertPages || alertPages.length === 0) {
    return true;
  }

  // Verificar se a página atual está na lista
  return alertPages.some((pageId) => {
    const page = ALERT_PAGES[pageId as AlertPageId];
    if (!page) return false;

    // Comparação exata de caminho
    if (currentPath === page.path) return true;

    // Verificar se a página atual começa com o caminho configurado seguido de /
    // Ex: /setor/ti/admin/chamados contém /setor/ti
    if (currentPath.startsWith(page.path + "/")) {
      return true;
    }

    return false;
  });
};
