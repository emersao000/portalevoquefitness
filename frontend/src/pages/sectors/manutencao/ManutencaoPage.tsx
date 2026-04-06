import Layout from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Plus } from "lucide-react";

export default function ManutencaoPage() {
  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Portal de Manutenção
          </h1>
          <p className="text-muted-foreground">
            Gerencie solicitações e acompanhe reparos e manutenção
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <Wrench className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">
              Solicitações de Reparo
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Abra novas solicitações de reparo e manutenção
            </p>
            <Button variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Nova Solicitação
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <Wrench className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">Minhas Solicitações</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Acompanhe o status de todas as suas solicitações
            </p>
            <Button variant="outline" className="w-full">
              Ver Solicitações
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-4">
              <Wrench className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-semibold text-lg mb-2">
              Histórico de Serviços
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Consulte reparos e manutenções realizadas anteriormente
            </p>
            <Button variant="outline" className="w-full">
              Ver Histórico
            </Button>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
