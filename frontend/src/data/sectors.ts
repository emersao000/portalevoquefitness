import { Server, ShoppingCart, Wrench, BarChart3 } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export interface Sector {
  slug: string;
  title: string;
  description: string;
  icon: IconType;
  subcategories?: string[];
}

const baseSectors: Sector[] = [
  {
    slug: "ti",
    title: "Portal de TI",
    description: "Gerencie chamados e otimize serviços de tecnologia.",
    icon: Server,
  },
  {
    slug: "financeiro",
    title: "Portal Financeiro",
    description:
      "Gerencie e acompanhe suas solicitações de compras e despesas.",
    icon: ShoppingCart,
  },
  {
    slug: "manutencao",
    title: "Portal de Manutenção",
    description: "Gerencie solicitações e acompanhe reparos.",
    icon: Wrench,
  },
  {
    slug: "bi",
    title: "Portal de BI",
    description: "Analise dados e visualize insights em dashboards.",
    icon: BarChart3,
  },
];

export interface BISubcategory {
  dashboard_id: string;
  title: string;
  category: string;
  category_name: string;
}

let cachedSubcategories: BISubcategory[] | null = null;

export async function loadBISubcategories(): Promise<BISubcategory[]> {
  if (cachedSubcategories) {
    return cachedSubcategories;
  }

  try {
    const response = await fetch("/api/powerbi/db/subcategories");
    if (!response.ok) {
      console.warn("Failed to load BI subcategories from API");
      return [];
    }
    const data = await response.json();
    cachedSubcategories = data.subcategories || [];
    console.log("[SECTORS] Loaded BI subcategories:", cachedSubcategories);
    return cachedSubcategories;
  } catch (error) {
    console.error("Error loading BI subcategories:", error);
    return [];
  }
}

export async function getSectorsWithSubcategories(): Promise<Sector[]> {
  const sectorsWithSub = [...baseSectors];
  const biIndex = sectorsWithSub.findIndex((s) => s.slug === "bi");
  if (biIndex !== -1) {
    const subcategories = await loadBISubcategories();
    if (subcategories.length > 0) {
      sectorsWithSub[biIndex].subcategories = subcategories;
    }
  }
  return sectorsWithSub;
}

export const sectors: Sector[] = baseSectors;
