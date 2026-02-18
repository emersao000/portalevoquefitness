import "./global.css";

import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Callback from "./pages/auth/Callback";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPasswordSuccess from "./pages/auth/ResetPasswordSuccess";
import ChangePassword from "./pages/auth/ChangePassword";
import AccessDenied from "./pages/AccessDenied";
import SectorPage from "./pages/Sector";
import TiPage from "./pages/sectors/ti/TiPage";
import ComprasPage from "./pages/sectors/compras/ComprasPage";
import ManutencaoPage from "./pages/sectors/manutencao/ManutencaoPage";
import BiPage from "./pages/sectors/bi/BiPage";
import AdminLayout from "./pages/sectors/ti/admin/AdminLayout";
import Overview from "./pages/sectors/ti/admin/Overview";
import ChamadosPage from "./pages/sectors/ti/admin/chamados/Index";
import UsuariosLayout from "./pages/sectors/ti/admin/usuarios/UsuariosLayout";
import {
  CriarUsuario,
  Bloqueios,
  Permissoes,
  Auth0Usuarios,
  Agentes,
  Grupos,
} from "./pages/sectors/ti/admin/usuarios/pages";
import IntegracoesLayout from "./pages/sectors/ti/admin/integracoes/IntegracoesLayout";
import {
  AdicionarUnidade,
  ListarUnidades,
  AdicionarBanco,
} from "./pages/sectors/ti/admin/integracoes/pages";
import ConfiguracoesLayout from "./pages/sectors/ti/admin/configuracoes/ConfiguracoesLayout";
import {
  Notificacoes as ConfNotificacoes,
  Acoes as ConfAcoes,
} from "./pages/sectors/ti/admin/configuracoes/pages";
import LoginMediaConfig from "./pages/sectors/ti/admin/configuracoes/LoginMediaConfig";
import AlertsConfig from "./pages/sectors/ti/admin/configuracoes/AlertsConfig";
import {
  Monitoramento as AdminMonitoramento,
  Historico as AdminHistorico,
} from "./pages/sectors/ti/admin/Sections";
import RequireLogin from "./components/RequireLogin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth0/login" element={<Login />} />
          <Route path="/auth/callback" element={<Callback />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/change-password" element={<ChangePassword />} />
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route
            path="/auth/reset-password-success"
            element={<ResetPasswordSuccess />}
          />
          <Route
            path="/setor/ti"
            element={
              <RequireLogin>
                <TiPage />
              </RequireLogin>
            }
          />
          <Route
            path="/setor/ti/admin"
            element={
              <RequireLogin>
                <AdminLayout />
              </RequireLogin>
            }
          >
            <Route index element={<Overview />} />
            <Route path="overview" element={<Overview />} />
            <Route path="chamados">
              <Route index element={<ChamadosPage />} />
              <Route path=":filtro" element={<ChamadosPage />} />
            </Route>
            <Route path="usuarios" element={<UsuariosLayout />}>
              <Route index element={<CriarUsuario />} />
              <Route path="criar" element={<CriarUsuario />} />
              <Route path="bloqueios" element={<Bloqueios />} />
              <Route path="permissoes" element={<Permissoes />} />
              <Route path="auth0" element={<Auth0Usuarios />} />
              <Route path="agentes" element={<Agentes />} />
              <Route path="grupos" element={<Grupos />} />
            </Route>
            <Route path="monitoramento" element={<AdminMonitoramento />} />
            <Route path="integracoes" element={<IntegracoesLayout />}>
              <Route index element={<AdicionarUnidade />} />
              <Route path="adicionar-unidade" element={<AdicionarUnidade />} />
              <Route path="listar-unidades" element={<ListarUnidades />} />
              <Route path="adicionar-ao-banco" element={<AdicionarBanco />} />
            </Route>
            <Route path="historico" element={<AdminHistorico />} />
            <Route path="configuracoes" element={<ConfiguracoesLayout />}>
              <Route index element={<ConfNotificacoes />} />
              <Route path="notificacoes" element={<ConfNotificacoes />} />
              <Route path="midia-login" element={<LoginMediaConfig />} />
              <Route path="alertas" element={<AlertsConfig />} />
              <Route path="acoes" element={<ConfAcoes />} />
            </Route>
          </Route>
          <Route
            path="/setor/compras"
            element={
              <RequireLogin>
                <ComprasPage />
              </RequireLogin>
            }
          />
          <Route
            path="/setor/manutencao"
            element={
              <RequireLogin>
                <ManutencaoPage />
              </RequireLogin>
            }
          />
          <Route
            path="/setor/bi"
            element={
              <RequireLogin>
                <BiPage />
              </RequireLogin>
            }
          />
          <Route
            path="/setor/:slug"
            element={
              <RequireLogin>
                <SectorPage />
              </RequireLogin>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
