import Layout from "@/components/layout/Layout";
import { sectors } from "@/data/sectors";

function SectorPlaceholder({ slug }: { slug: string }) {
  const sector = sectors.find((s) => s.slug === slug);
  return (
    <Layout>
      <section className="w-full">
        <div className="brand-gradient">
          <div className="container py-10 sm:py-14">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary-foreground drop-shadow">
              {sector?.title}
            </h1>
            <p className="mt-2 text-primary-foreground/90 max-w-2xl">
              {sector?.description}
            </p>
          </div>
        </div>
      </section>
      <section className="container py-8">
        <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8">
          <p className="text-muted-foreground">
            Conteúdo deste setor será adicionado conforme sua orientação.
          </p>
        </div>
      </section>
    </Layout>
  );
}

export const ComprasPage = () => <SectorPlaceholder slug="financeiro" />;
export const ManutencaoPage = () => <SectorPlaceholder slug="manutencao" />;
export const FinanceiroPage = () => <SectorPlaceholder slug="financeiro" />;
export const MarketingPage = () => <SectorPlaceholder slug="marketing" />;
export const ProdutosPage = () => <SectorPlaceholder slug="produtos" />;
export const ComercialPage = () => <SectorPlaceholder slug="comercial" />;
export const OutrosServicosPage = () => (
  <SectorPlaceholder slug="outros-servicos" />
);
