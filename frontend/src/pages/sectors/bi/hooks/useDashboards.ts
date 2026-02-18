import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useAuthContext } from "@/lib/auth-context";

export interface Dashboard {
  id: number;
  dashboard_id: string;
  title: string;
  description: string | null;
  report_id: string;
  dataset_id: string | null;
  category: string;
  category_name: string;
  order: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface DashboardCategory {
  id: string;
  name: string;
  dashboards: Dashboard[];
}

export function useDashboards() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<DashboardCategory[]>([]);
  const prevCategoriesRef = useRef<DashboardCategory[] | null>(null);
  const isFetchingRef = useRef(false);
  const { user } = useAuthContext();

  // Debug: Log user data on mount and when it changes
  useEffect(() => {
    console.log("[BI] 👤 useAuth user data updated:", {
      id: user?.id,
      email: user?.email,
      bi_subcategories: user?.bi_subcategories,
      bi_subcategories_type: typeof user?.bi_subcategories,
      bi_subcategories_is_array: Array.isArray(user?.bi_subcategories),
      bi_subcategories_is_null: user?.bi_subcategories === null,
      bi_subcategories_length: Array.isArray(user?.bi_subcategories)
        ? user.bi_subcategories.length
        : "N/A",
    });
  }, [user?.id, user?.bi_subcategories?.join(","), user?.bi_subcategories]);

  useEffect(() => {
    const fetchDashboards = async () => {
      // Prevent multiple simultaneous fetches
      if (isFetchingRef.current) {
        console.log(
          "[BI] ⏸️  Fetch já em progresso, ignorando nova requisição",
        );
        return;
      }

      try {
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        console.log("[BI] 📥 Buscando dashboards do banco de dados...");

        const response = await apiFetch("/powerbi/db/dashboards");

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: Falha ao buscar dashboards do servidor`,
          );
        }

        const dashboards: Dashboard[] = await response.json();

        if (!Array.isArray(dashboards)) {
          throw new Error("Resposta inválida: esperado array de dashboards");
        }

        console.log(`[BI] ✅ ${dashboards.length} dashboards encontrados`);

        // Log cada dashboard para debug
        dashboards.forEach((dash) => {
          console.log(`[BI]   - ${dash.title} (${dash.dashboard_id})`);
          console.log(`[BI]     Report: ${dash.report_id}`);
          console.log(`[BI]     Dataset: ${dash.dataset_id}`);
        });

        // Filter dashboards based on user permissions
        let filteredDashboards = dashboards;

        console.log("[BI] 🔍 Filtragem de dashboards:", {
          user_id: user?.id,
          user_email: user?.email,
          bi_subcategories: user?.bi_subcategories,
          bi_subcategories_type: typeof user?.bi_subcategories,
          bi_subcategories_is_null: user?.bi_subcategories === null,
          bi_subcategories_is_array: Array.isArray(user?.bi_subcategories),
          bi_subcategories_length: Array.isArray(user?.bi_subcategories)
            ? user.bi_subcategories.length
            : "N/A",
          total_dashboards_available: dashboards.length,
        });

        if (
          user &&
          user.bi_subcategories !== null &&
          user.bi_subcategories !== undefined
        ) {
          // User has bi_subcategories explicitly set (array, even if empty)
          if (
            Array.isArray(user.bi_subcategories) &&
            user.bi_subcategories.length > 0
          ) {
            // User has specific dashboards allowed
            console.log(
              `[BI] 🔐 Filtrando dashboards por permissão do usuário:`,
              user.bi_subcategories,
            );
            filteredDashboards = dashboards.filter((dash) =>
              user.bi_subcategories.includes(dash.dashboard_id),
            );
            console.log(
              `[BI] ✅ ${filteredDashboards.length} dashboards após filtragem`,
            );
          } else if (
            Array.isArray(user.bi_subcategories) &&
            user.bi_subcategories.length === 0
          ) {
            // User has BI sector but no dashboards selected - restrict all
            console.log(
              "[BI] 🔒 Usuário tem setor BI mas sem dashboards selecionados - acesso negado",
            );
            filteredDashboards = [];
          }
        } else {
          // User doesn't have bi_subcategories (null/undefined) - no restriction, show all
          console.log(
            "[BI] 📚 Usuário sem restrições de BI - mostrando todos os dashboards",
          );
          filteredDashboards = dashboards;
        }

        // Group dashboards by category
        const grouped = filteredDashboards.reduce((acc, dashboard) => {
          const existingCategory = acc.find(
            (cat) => cat.id === dashboard.category,
          );

          if (existingCategory) {
            existingCategory.dashboards.push(dashboard);
          } else {
            acc.push({
              id: dashboard.category,
              name: dashboard.category_name,
              dashboards: [dashboard],
            });
          }

          return acc;
        }, [] as DashboardCategory[]);

        // Sort dashboards within each category by order
        grouped.forEach((category) => {
          category.dashboards.sort((a, b) => a.order - b.order);
        });

        // Only update state if data actually changed
        const dataChanged =
          prevCategoriesRef.current === null ||
          JSON.stringify(prevCategoriesRef.current) !== JSON.stringify(grouped);

        if (dataChanged) {
          console.log(
            `[BI] ✅ Dashboards organizados em ${grouped.length} categorias`,
          );
          prevCategoriesRef.current = grouped;
          setCategories(grouped);
        } else {
          console.log(
            "[BI] ℹ️ Dados de dashboards não mudaram, evitando re-render",
          );
          prevCategoriesRef.current = grouped;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        console.error("[BI] ❌ Erro ao buscar dashboards:", message);
        setError(message);
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
      }
    };

    fetchDashboards();
  }, [user?.id, user?.bi_subcategories?.join(",")]); // Refetch quando ID ou permissões mudam

  const getDashboardById = (dashboardId: string): Dashboard | undefined => {
    for (const category of categories) {
      const dashboard = category.dashboards.find(
        (d) => d.dashboard_id === dashboardId,
      );
      if (dashboard) return dashboard;
    }
    return undefined;
  };

  // Função para forçar refresh manual (se necessário)
  const refreshDashboards = () => {
    prevCategoriesRef.current = null;
    setLoading(true);
    setCategories([]);
  };

  return {
    categories,
    loading,
    error,
    getDashboardById,
    refreshDashboards,
  };
}
