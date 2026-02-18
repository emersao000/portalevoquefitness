import { PrioridadesProblemas as PrioridadesComponent } from "./PrioridadesProblemas";
import NotificationSettingsConfig from "./NotificationSettingsConfig";

function Panel({ title }: { title: string }) {
  return (
    <div className="card-surface rounded-xl p-4 text-sm">
      <div className="font-semibold mb-2">{title}</div>
      <p className="text-muted-foreground">
        Configurações mock para {title.toLowerCase()}.
      </p>
    </div>
  );
}

export function Prioridades() {
  return <PrioridadesComponent />;
}

export function Notificacoes() {
  return <NotificationSettingsConfig />;
}

export function Acoes() {
  return <Panel title="Ações do Sistema" />;
}
