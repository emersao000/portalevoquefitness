export function Placeholder({ title }: { title: string }) {
  return (
    <div className="card-surface rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground">
        Conteúdo será adicionado conforme sua orientação.
      </p>
    </div>
  );
}

export const Chamados = () => <Placeholder title="Gerenciar chamados" />;
export const Usuarios = () => <Placeholder title="Gerenciar usuários" />;
export const Monitoramento = () => <Placeholder title="Monitoramento" />;
export const Integracoes = () => <Placeholder title="Integrações" />;
export const Sistema = () => <Placeholder title="Sistema" />;
export const Historico = () => <Placeholder title="Histórico" />;
export const Configuracoes = () => <Placeholder title="Configurações" />;
