export type TicketStatus =
  | "ABERTO"
  | "EM_ATENDIMENTO"
  | "AGUARDANDO"
  | "CONCLUIDO"
  | "EXPIRADO";

export interface TicketMock {
  id: string;
  codigo: string;
  titulo: string;
  solicitante: string;
  unidade: string;
  categoria: string; // mapeia "Problema Reportado"
  status: TicketStatus;
  criadoEm: string; // ISO
  protocolo: string;
  cargo: "Coordenador" | "Funcionário" | "Gerente" | "Gerente regional";
  gerente: string;
  email: string;
  telefone: string; // numérico
  internetItem?: string;
  visita?: string; // yyyy-mm-dd
}

export const ticketsMock: TicketMock[] = Array.from({ length: 24 }).map(
  (_, i) => {
    const statuses: TicketStatus[] = [
      "ABERTO",
      "EM_ATENDIMENTO",
      "AGUARDANDO",
      "CONCLUIDO",
      "EXPIRADO",
    ];
    const cats = [
      "Internet",
      "CFTV",
      "Notebook/Desktop",
      "Sistema EVO",
      "Som",
      "Catraca",
    ];
    const cargos = [
      "Coordenador",
      "Funcionário",
      "Gerente",
      "Gerente regional",
    ] as const;
    const gerentes = ["Ana Lima", "Bruno Alves", "Carla Souza", "Daniel Reis"];
    const status = statuses[i % statuses.length];
    const day = (i % 27) + 1;
    const categoria = cats[i % cats.length];
    const criado = new Date(2025, 0, day, 9 + (i % 8));
    const id = `TCK-${(1000 + i).toString()}`;
    const codigo = `EVQ-${String(81 + i).padStart(4, "0")}`;
    const solicitante = ["Bruna", "Carlos", "Diego", "Fernanda", "Gustavo"][
      i % 5
    ];
    const email = `${solicitante.toLowerCase().replace(/\s+/g, ".")}@evoque.com`;
    const telefone = `11${String(987654321 + i).slice(0, 9)}`; // 11 + 9 dígitos
    const internetItems = [
      "Antenas",
      "Cabo de rede",
      "DVR",
      "Roteador/Modem",
      "Switch",
      "Wi-fi",
    ];
    const internetItem =
      categoria === "Internet"
        ? internetItems[i % internetItems.length]
        : undefined;
    const visitaDate = new Date(2025, 0, Math.min(day + 2, 28))
      .toISOString()
      .slice(0, 10);

    return {
      id,
      codigo,
      titulo: `${categoria} - Ocorrência ${i + 1}`,
      solicitante,
      unidade: ["Centro", "Zona Sul", "Zona Norte", "Zona Leste"][i % 4],
      categoria,
      status,
      criadoEm: criado.toISOString(),
      protocolo: `${criado.getFullYear()}${String(criado.getMonth() + 1).padStart(2, "0")}${String(criado.getDate()).padStart(2, "0")}-${(i % 9) + 1}`,
      cargo: cargos[i % cargos.length],
      gerente: gerentes[i % gerentes.length],
      email,
      telefone,
      internetItem,
      visita: visitaDate,
    };
  },
);

export interface UsuarioMock {
  id: string;
  nome: string;
  email: string;
  perfil: "Administrador" | "Agente" | "Padrão";
  bloqueado?: boolean;
}

export const usuariosMock: UsuarioMock[] = [
  {
    id: "U-01",
    nome: "Ana Lima",
    email: "ana@evoque.com",
    perfil: "Administrador",
  },
  {
    id: "U-02",
    nome: "Bruno Alves",
    email: "bruno@evoque.com",
    perfil: "Agente",
  },
  {
    id: "U-03",
    nome: "Carla Souza",
    email: "carla@evoque.com",
    perfil: "Padrão",
    bloqueado: true,
  },
  {
    id: "U-04",
    nome: "Daniel Reis",
    email: "daniel@evoque.com",
    perfil: "Agente",
  },
];

export interface UnidadeMock {
  id: string;
  nome: string;
  cidade: string;
}
export const unidadesMock: UnidadeMock[] = [
  { id: "UN-01", nome: "Centro", cidade: "São Paulo" },
  { id: "UN-02", nome: "Zona Sul", cidade: "São Paulo" },
  { id: "UN-03", nome: "Zona Norte", cidade: "São Paulo" },
  { id: "UN-04", nome: "Zona Leste", cidade: "São Paulo" },
];
