import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-[100svh] md:min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold mb-2">404</h1>
        <p className="text-base text-muted-foreground mb-6">
          Página não encontrada
        </p>
        <a
          href="/"
          className="inline-block rounded-md px-4 py-2 bg-primary text-primary-foreground"
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
