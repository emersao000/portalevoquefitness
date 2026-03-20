import Layout from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus } from "lucide-react";

export default function ComprasPage() {
  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Portal Financeiro
          </h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe suas solicitações
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <ShoppingCart className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">
              Solicitações de Compra
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Registre e acompanhe novas solicitações de compra
            </p>
            <Button variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Nova Solicitação
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <ShoppingCart className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Histórico</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Consulte todas as solicitações de compra anteriores
            </p>
            <Button variant="outline" className="w-full">
              Ver Histórico
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <ShoppingCart className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Relatórios</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Gere relatórios de despesas e gastos com compras
            </p>
            <Button variant="outline" className="w-full">
              Gerar Relatório
            </Button>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
