import { Link } from "react-router-dom";

export default function AccessDenied() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-md rounded-xl border border-border/60 bg-card p-6 text-center">
        <h2 className="text-2xl font-semibold mb-2">Acesso negado</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Você não tem permissão para acessar esta área.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/">
            <button className="rounded-md px-4 py-2 bg-secondary text-secondary-foreground">
              Voltar ao início
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
