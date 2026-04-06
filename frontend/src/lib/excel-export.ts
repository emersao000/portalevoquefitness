import ExcelJS from "exceljs";

interface TicketData {
  id: number;
  codigo: string;
  protocolo: string;
  solicitante: string;
  problema: string;
  descricao: string;
  status: string;
  prioridade: string;
  unidade: string;
  data_abertura: string | null;
  data_conclusao: string | null;
  data_ultima_atualizacao: string | null;
}

interface ReportData {
  count: number;
  total: number;
  data_relatorio: string;
  tickets: TicketData[];
}

// ========================================
// CONFIGURAÇÃO DE ESTILOS PADRONIZADOS
// ========================================
const THEME_COLORS = {
  header: {
    background: "FF366092", // Azul escuro
    text: "FFFFFFFF",        // Branco
  },
  // Fundos para campos específicos
  codigo: {
    background: "FFE7F3FF", // Azul claro
    text: "FF1F4E78",        // Azul escuro para texto
  },
  protocolo: {
    background: "FFFFF4E6", // Laranja claro
    text: "FFE67E22",        // Laranja escuro
  },
  // Status
  status: {
    concluido: {
      background: "FFD4EDDA", // Verde claro
      text: "FF155724",        // Verde escuro
    },
    aberto: {
      background: "FFFFEAA7", // Amarelo claro
      text: "FFD68910",        // Amarelo escuro
    },
    expirado: {
      background: "FFF8D7DA", // Vermelho claro
      text: "FF721C24",        // Vermelho escuro
    },
    default: {
      background: "FFE2E3E5", // Cinza claro
      text: "FF383D41",        // Cinza escuro
    },
  },
  // Prioridades
  prioridade: {
    urgente: {
      background: "FFFFE0E0", // Vermelho bem claro
      text: "FFC00000",        // Vermelho
    },
    alta: {
      background: "FFFFF0E0", // Laranja claro
      text: "FFFF6B00",        // Laranja
    },
    media: {
      background: "FFFFFF9D", // Amarelo claro
      text: "FFF39C12",        // Amarelo escuro
    },
    baixa: {
      background: "FFE8F5E9", // Verde claro
      text: "FF2E7D32",        // Verde
    },
  },
  // Última atualização
  atualizacao: {
    background: "FFF3E5F5", // Roxo claro
    text: "FF6A1B9A",        // Roxo escuro
  },
  highlight: "FFFFC000",     // Laranja (para destaques)
  success: "FF70AD47",       // Verde
  error: "FFC00000",         // Vermelho
  warning: "FFFFF2CC",       // Amarelo claro
  rowAlternate: "FFF9F9F9",  // Cinza muito claro para linhas alternadas
  border: "FFD3D3D3",        // Cinza para bordas
  // Cores para gráficos
  chart: {
    blue: "FF366092",
    green: "FF70AD47",
    orange: "FFFFC000",
    red: "FFC00000",
    purple: "FF6A1B9A",
    teal: "FF17A2B8",
    pink: "FFE83E8C",
    yellow: "FFFFC107",
  },
};

const FONT_CONFIG = {
  standard: "Arial",
  headerSize: 12,
  dataSize: 11,
  titleSize: 16,
  highlightSize: 12,
  summaryTitle: 18,
  sectionTitle: 14,
};

// ========================================
// FUNÇÃO PRINCIPAL DE EXPORTAÇÃO
// ========================================
export async function exportToExcel(
  data: ReportData,
  fileName: string = "relatorio_chamados_30dias.xlsx"
) {
  if (!data.tickets || data.tickets.length === 0) {
    alert("Nenhum dado disponível para exportar");
    return;
  }

  const workbook = new ExcelJS.Workbook();

  // Configurar propriedades do workbook
  workbook.creator = "Sistema de Chamados";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Criar abas
  createSummarySheet(workbook, data); // Resumo primeiro
  createTicketsSheet(workbook, data);  // Lista de chamados depois

  // Salvar arquivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

// ========================================
// ABA 2: LISTA DE CHAMADOS
// ========================================
function createTicketsSheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const worksheet = workbook.addWorksheet("📋 Lista Completa");

  // Definir colunas com larguras otimizadas
  const columns = [
    { header: "#", key: "numero", width: 6 },
    { header: "Código", key: "codigo", width: 13 },
    { header: "Protocolo", key: "protocolo", width: 14 },
    { header: "Solicitante", key: "solicitante", width: 20 },
    { header: "Problema", key: "problema", width: 17 },
    { header: "Descrição", key: "descricao", width: 50 }, // LARGURA MAIOR PARA DESCRIÇÃO
    { header: "Status", key: "status", width: 13 },
    { header: "Prioridade", key: "prioridade", width: 12 },
    { header: "Unidade", key: "unidade", width: 20 },
    { header: "Data Abertura", key: "data_abertura", width: 17 },
    { header: "Data Conclusão", key: "data_conclusao", width: 17 },
    { header: "Última Atualização", key: "data_ultima_atualizacao", width: 19 },
  ];

  worksheet.columns = columns;

  // Estilo do cabeçalho
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = {
    bold: true,
    color: { argb: THEME_COLORS.header.text },
    size: FONT_CONFIG.headerSize,
    name: FONT_CONFIG.standard,
  };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: THEME_COLORS.header.background },
  };
  headerRow.alignment = {
    horizontal: "center",
    vertical: "center",
    wrapText: true,
  };

  // Bordas do cabeçalho
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  });

  // Adicionar dados
  data.tickets.forEach((ticket, index) => {
    const row = worksheet.addRow({
      numero: index + 1,
      codigo: ticket.codigo,
      protocolo: ticket.protocolo,
      solicitante: ticket.solicitante,
      problema: ticket.problema,
      descricao: ticket.descricao,
      status: ticket.status,
      prioridade: ticket.prioridade,
      unidade: ticket.unidade,
      data_abertura: ticket.data_abertura ? formatDate(ticket.data_abertura) : "-",
      data_conclusao: ticket.data_conclusao ? formatDate(ticket.data_conclusao) : "-",
      data_ultima_atualizacao: ticket.data_ultima_atualizacao ? formatDate(ticket.data_ultima_atualizacao) : "-",
    });

    const useAlternateRow = index % 2 === 0;

    // Calcular altura da linha baseada no comprimento da descrição
    const descLength = ticket.descricao?.length || 0;
    const estimatedLines = Math.ceil(descLength / 80); // Aproximadamente 80 caracteres por linha
    row.height = Math.max(30, estimatedLines * 15); // Mínimo 30, aumenta com o conteúdo

    // Estilo das células
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Bordas padrão
      cell.border = {
        top: { style: "thin", color: { argb: THEME_COLORS.border } },
        left: { style: "thin", color: { argb: THEME_COLORS.border } },
        bottom: { style: "thin", color: { argb: THEME_COLORS.border } },
        right: { style: "thin", color: { argb: THEME_COLORS.border } },
      };

      // Fonte padrão
      cell.font = {
        size: FONT_CONFIG.dataSize,
        name: FONT_CONFIG.standard,
      };

      // Estilos específicos por coluna
      switch (colNumber) {
        case 1: // # - Número
          cell.alignment = { horizontal: "center", vertical: "center" };
          if (useAlternateRow) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.rowAlternate } };
          }
          break;

        case 2: // Código - FUNDO AZUL CLARO
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.codigo.background } };
          cell.font = {
            size: FONT_CONFIG.highlightSize,
            name: FONT_CONFIG.standard,
            bold: true,
            color: { argb: THEME_COLORS.codigo.text },
          };
          cell.alignment = { horizontal: "center", vertical: "center" };
          break;

        case 3: // Protocolo - FUNDO LARANJA CLARO
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.protocolo.background } };
          cell.font = {
            size: FONT_CONFIG.highlightSize,
            name: FONT_CONFIG.standard,
            bold: true,
            color: { argb: THEME_COLORS.protocolo.text },
          };
          cell.alignment = { horizontal: "center", vertical: "center" };
          break;

        case 4: // Solicitante
        case 5: // Problema
        case 9: // Unidade
          cell.alignment = {
            horizontal: "left",
            vertical: "center",
            wrapText: false, // Sem quebra para não bagunçar
          };
          if (useAlternateRow) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.rowAlternate } };
          }
          break;

        case 6: // Descrição - COM QUEBRA DE LINHA
          cell.alignment = {
            horizontal: "left",
            vertical: "top", // Alinhamento no topo
            wrapText: true,  // QUEBRA DE LINHA ATIVADA
          };
          if (useAlternateRow) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.rowAlternate } };
          }
          break;

        case 7: // Status - FUNDOS COLORIDOS
          const statusLower = ticket.status?.toLowerCase() || "";
          let statusStyle = THEME_COLORS.status.default;

          if (statusLower.includes("concluído") || statusLower.includes("concluido") || statusLower.includes("resolvido") || statusLower.includes("fechado") || statusLower.includes("finalizado")) {
            statusStyle = THEME_COLORS.status.concluido;
          } else if (statusLower.includes("aberto") || statusLower.includes("andamento") || statusLower.includes("atendimento") || statusLower.includes("pendente") || statusLower.includes("aguardando")) {
            statusStyle = THEME_COLORS.status.aberto;
          } else if (statusLower.includes("expirado")) {
            statusStyle = THEME_COLORS.status.cancelado;
          }

          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusStyle.background } };
          cell.font = {
            size: FONT_CONFIG.highlightSize,
            name: FONT_CONFIG.standard,
            bold: true,
            color: { argb: statusStyle.text },
          };
          cell.alignment = { horizontal: "center", vertical: "center" };
          break;

        case 8: // Prioridade - FUNDOS COLORIDOS
          const prioridadeLower = ticket.prioridade?.toLowerCase() || "";
          let prioridadeStyle = THEME_COLORS.prioridade.baixa;

          if (prioridadeLower.includes("urgente")) {
            prioridadeStyle = THEME_COLORS.prioridade.urgente;
          } else if (prioridadeLower.includes("alta")) {
            prioridadeStyle = THEME_COLORS.prioridade.alta;
          } else if (prioridadeLower.includes("média") || prioridadeLower.includes("media")) {
            prioridadeStyle = THEME_COLORS.prioridade.media;
          }

          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: prioridadeStyle.background } };
          cell.font = {
            size: FONT_CONFIG.highlightSize,
            name: FONT_CONFIG.standard,
            bold: true,
            color: { argb: prioridadeStyle.text },
          };
          cell.alignment = { horizontal: "center", vertical: "center" };
          break;

        case 10: // Data Abertura
        case 11: // Data Conclusão
          cell.alignment = { horizontal: "center", vertical: "center" };
          if (useAlternateRow) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.rowAlternate } };
          }
          break;

        case 12: // Última Atualização - FUNDO ROXO CLARO
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.atualizacao.background } };
          cell.font = {
            size: FONT_CONFIG.highlightSize,
            name: FONT_CONFIG.standard,
            bold: true,
            color: { argb: THEME_COLORS.atualizacao.text },
          };
          cell.alignment = { horizontal: "center", vertical: "center" };
          break;
      }
    });
  });

  // Congelar linha de cabeçalho
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // Auto-filtro
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.tickets.length + 1, column: columns.length },
  };
}

// ========================================
// ABA 1: RESUMO E ANÁLISES (continua igual)
// ========================================
function createSummarySheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const worksheet = workbook.addWorksheet("📊 Resumo Executivo");

  // Calcular período
  const dates = data.tickets
    .map(t => t.data_abertura)
    .filter(d => d !== null)
    .map(d => new Date(d!));

  const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();

  const periodoTexto = `${minDate.toLocaleDateString('pt-BR')} a ${maxDate.toLocaleDateString('pt-BR')}`;

  let currentRow = 1;

  // Cabeçalho principal
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = "📊 RELATÓRIO DE CHAMADOS - RESUMO EXECUTIVO";
  titleCell.font = {
    bold: true,
    size: FONT_CONFIG.summaryTitle,
    name: FONT_CONFIG.standard,
    color: { argb: THEME_COLORS.header.background },
  };
  titleCell.alignment = { horizontal: "center", vertical: "center" };
  worksheet.getRow(currentRow).height = 35;
  currentRow += 2;

  // Informações gerais
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const infoCell = worksheet.getCell(`A${currentRow}`);
  infoCell.value = `📅 Período: ${periodoTexto}`;
  infoCell.font = {
    bold: true,
    size: FONT_CONFIG.sectionTitle,
    name: FONT_CONFIG.standard,
  };
  infoCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F8FF" },
  };
  infoCell.alignment = { horizontal: "center", vertical: "center" };
  infoCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" },
  };
  worksheet.getRow(currentRow).height = 30;
  currentRow++;

  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const totalCell = worksheet.getCell(`A${currentRow}`);
  totalCell.value = `📋 Total: ${data.count} chamados abertos no período`;
  totalCell.font = {
    bold: true,
    size: FONT_CONFIG.sectionTitle,
    name: FONT_CONFIG.standard,
    color: { argb: THEME_COLORS.header.background },
  };
  totalCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFE0" },
  };
  totalCell.alignment = { horizontal: "center", vertical: "center" };
  totalCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" },
  };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 3;

  // Análise por Status
  const statusCount = countBy(data.tickets, "status");
  currentRow = createStatusTable(worksheet, statusCount, data.count, currentRow);

  // Análise por Problema
  const problemCount = countBy(data.tickets, "problema");
  currentRow = createProblemTable(worksheet, problemCount, data.count, currentRow);

  // Análise por Prioridade
  const priorityCount = countBy(data.tickets, "prioridade");
  currentRow = createPriorityTable(worksheet, priorityCount, data.count, currentRow);

  // Top 5 Unidades
  const unidadeCount = countBy(data.tickets, "unidade");
  createTopUnitsTable(worksheet, unidadeCount, data.count, currentRow);

  // Ajustar largura das colunas
  worksheet.getColumn(1).width = 35;
  worksheet.getColumn(2).width = 12;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 15;
}

// Funções auxiliares de criação de tabelas (mesmas do código anterior)
function createStatusTable(ws: ExcelJS.Worksheet, statusCount: Record<string, number>, total: number, startRow: number): number {
  let currentRow = startRow;

  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const titleCell = ws.getCell(`A${currentRow}`);
  titleCell.value = "📊 ANÁLISE POR STATUS";
  titleCell.font = { bold: true, size: FONT_CONFIG.sectionTitle, name: FONT_CONFIG.standard, color: { argb: THEME_COLORS.header.text } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.header.background } };
  titleCell.alignment = { horizontal: "center", vertical: "center" };
  ws.getRow(currentRow).height = 25;
  currentRow++;

  ["Status", "Quantidade", "Percentual", "Barra Visual"].forEach((header, idx) => {
    const cell = ws.getRow(currentRow).getCell(idx + 1);
    cell.value = header;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.header.background } };
    cell.font = { bold: true, color: { argb: THEME_COLORS.header.text }, size: FONT_CONFIG.headerSize, name: FONT_CONFIG.standard };
    cell.alignment = { horizontal: "center", vertical: "center" };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  currentRow++;

  const sortedStatus = Object.entries(statusCount).sort(([, a], [, b]) => b - a);
  const maxCount = Math.max(...Object.values(statusCount));

  sortedStatus.forEach(([status, count], index) => {
    const row = ws.getRow(currentRow);
    const percentage = (count / total) * 100;

    row.getCell(1).value = status;
    row.getCell(1).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: true };

    row.getCell(2).value = count;
    row.getCell(2).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(2).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: true };

    row.getCell(3).value = `${percentage.toFixed(1)}%`;
    row.getCell(3).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(3).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: true };

    const barLength = Math.round((count / maxCount) * 20);
    row.getCell(4).value = "█".repeat(barLength);
    row.getCell(4).font = { size: FONT_CONFIG.dataSize, color: { argb: THEME_COLORS.chart.blue } };

    [1, 2, 3, 4].forEach((col) => {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin", color: { argb: THEME_COLORS.border } },
        left: { style: "thin", color: { argb: THEME_COLORS.border } },
        bottom: { style: "thin", color: { argb: THEME_COLORS.border } },
        right: { style: "thin", color: { argb: THEME_COLORS.border } },
      };
      if (index % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.rowAlternate } };
      }
    });

    row.height = 22;
    currentRow++;
  });

  return currentRow + 2;
}

function createProblemTable(ws: ExcelJS.Worksheet, problemCount: Record<string, number>, total: number, startRow: number): number {
  let currentRow = startRow;

  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const titleCell = ws.getCell(`A${currentRow}`);
  titleCell.value = "🔧 RESUMO POR TIPO DE PROBLEMA";
  titleCell.font = { bold: true, size: FONT_CONFIG.sectionTitle, name: FONT_CONFIG.standard, color: { argb: THEME_COLORS.header.text } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.header.background } };
  titleCell.alignment = { horizontal: "center", vertical: "center" };
  ws.getRow(currentRow).height = 25;
  currentRow++;

  ["Tipo de Problema", "Quantidade", "Percentual", "Observação"].forEach((header, idx) => {
    const cell = ws.getRow(currentRow).getCell(idx + 1);
    cell.value = header;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.header.background } };
    cell.font = { bold: true, color: { argb: THEME_COLORS.header.text }, size: FONT_CONFIG.headerSize, name: FONT_CONFIG.standard };
    cell.alignment = { horizontal: "center", vertical: "center" };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  currentRow++;

  const sortedProblems = Object.entries(problemCount).sort(([, a], [, b]) => b - a);

  sortedProblems.forEach(([problema, count], index) => {
    const row = ws.getRow(currentRow);
    const percentage = (count / total) * 100;
    const isMaiorIncidencia = index === 0;

    row.getCell(1).value = problema;
    row.getCell(1).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: isMaiorIncidencia };

    row.getCell(2).value = count;
    row.getCell(2).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(2).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: isMaiorIncidencia };

    row.getCell(3).value = `${percentage.toFixed(1)}%`;
    row.getCell(3).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(3).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: isMaiorIncidencia };

    if (isMaiorIncidencia) {
      row.getCell(4).value = "⚠️ MAIOR INCIDÊNCIA";
      row.getCell(4).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: true, color: { argb: THEME_COLORS.error } };
      row.getCell(4).alignment = { horizontal: "center", vertical: "center" };
    }

    [1, 2, 3, 4].forEach((col) => {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin", color: { argb: THEME_COLORS.border } },
        left: { style: "thin", color: { argb: THEME_COLORS.border } },
        bottom: { style: "thin", color: { argb: THEME_COLORS.border } },
        right: { style: "thin", color: { argb: THEME_COLORS.border } },
      };

      if (isMaiorIncidencia) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0E0" } };
      } else if (index % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.rowAlternate } };
      }
    });

    row.height = 22;
    currentRow++;
  });

  return currentRow + 2;
}

function createPriorityTable(ws: ExcelJS.Worksheet, priorityCount: Record<string, number>, total: number, startRow: number): number {
  let currentRow = startRow;

  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const titleCell = ws.getCell(`A${currentRow}`);
  titleCell.value = "🚨 ANÁLISE POR PRIORIDADE";
  titleCell.font = { bold: true, size: FONT_CONFIG.sectionTitle, name: FONT_CONFIG.standard, color: { argb: THEME_COLORS.header.text } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.header.background } };
  titleCell.alignment = { horizontal: "center", vertical: "center" };
  ws.getRow(currentRow).height = 25;
  currentRow++;

  ["Prioridade", "Quantidade", "Percentual", "Barra Visual"].forEach((header, idx) => {
    const cell = ws.getRow(currentRow).getCell(idx + 1);
    cell.value = header;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.header.background } };
    cell.font = { bold: true, color: { argb: THEME_COLORS.header.text }, size: FONT_CONFIG.headerSize, name: FONT_CONFIG.standard };
    cell.alignment = { horizontal: "center", vertical: "center" };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  currentRow++;

  const priorityOrder = ["Urgente", "Alta", "Média", "Media", "Baixa"];
  const sortedPriority = Object.entries(priorityCount).sort((a, b) => {
    const indexA = priorityOrder.findIndex(p => a[0].toLowerCase().includes(p.toLowerCase()));
    const indexB = priorityOrder.findIndex(p => b[0].toLowerCase().includes(p.toLowerCase()));
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const maxCount = Math.max(...Object.values(priorityCount));

  sortedPriority.forEach(([prioridade, count], index) => {
    const row = ws.getRow(currentRow);
    const percentage = (count / total) * 100;

    row.getCell(1).value = prioridade;
    row.getCell(1).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: true };

    row.getCell(2).value = count;
    row.getCell(2).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(2).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: true };

    row.getCell(3).value = `${percentage.toFixed(1)}%`;
    row.getCell(3).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(3).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: true };

    const barLength = Math.round((count / maxCount) * 20);
    row.getCell(4).value = "█".repeat(barLength);

    let barColor = THEME_COLORS.chart.green;
    const prioLower = prioridade.toLowerCase();
    if (prioLower.includes("urgente")) barColor = THEME_COLORS.error;
    else if (prioLower.includes("alta")) barColor = THEME_COLORS.chart.orange;
    else if (prioLower.includes("média") || prioLower.includes("media")) barColor = THEME_COLORS.chart.yellow;

    row.getCell(4).font = { size: FONT_CONFIG.dataSize, color: { argb: barColor } };

    [1, 2, 3, 4].forEach((col) => {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin", color: { argb: THEME_COLORS.border } },
        left: { style: "thin", color: { argb: THEME_COLORS.border } },
        bottom: { style: "thin", color: { argb: THEME_COLORS.border } },
        right: { style: "thin", color: { argb: THEME_COLORS.border } },
      };

      if (index % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.rowAlternate } };
      }
    });

    row.height = 22;
    currentRow++;
  });

  return currentRow + 2;
}

function createTopUnitsTable(ws: ExcelJS.Worksheet, unidadeCount: Record<string, number>, total: number, startRow: number): void {
  let currentRow = startRow;

  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const titleCell = ws.getCell(`A${currentRow}`);
  titleCell.value = "🏢 TOP 5 UNIDADES COM MAIS CHAMADOS";
  titleCell.font = { bold: true, size: FONT_CONFIG.sectionTitle, name: FONT_CONFIG.standard, color: { argb: THEME_COLORS.header.text } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.header.background } };
  titleCell.alignment = { horizontal: "center", vertical: "center" };
  ws.getRow(currentRow).height = 25;
  currentRow++;

  ["Posição", "Unidade", "Quantidade", "Percentual"].forEach((header, idx) => {
    const cell = ws.getRow(currentRow).getCell(idx + 1);
    cell.value = header;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.header.background } };
    cell.font = { bold: true, color: { argb: THEME_COLORS.header.text }, size: FONT_CONFIG.headerSize, name: FONT_CONFIG.standard };
    cell.alignment = { horizontal: "center", vertical: "center" };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  currentRow++;

  const topUnidades = Object.entries(unidadeCount).sort(([, a], [, b]) => b - a).slice(0, 5);
  const medals = ["🥇", "🥈", "🥉", "4º", "5º"];

  topUnidades.forEach(([unidade, count], index) => {
    const row = ws.getRow(currentRow);
    const percentage = (count / total) * 100;

    row.getCell(1).value = medals[index];
    row.getCell(1).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(1).font = { size: FONT_CONFIG.highlightSize, name: FONT_CONFIG.standard, bold: true };

    row.getCell(2).value = unidade;
    row.getCell(2).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: index < 3 };

    row.getCell(3).value = count;
    row.getCell(3).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(3).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: index < 3 };

    row.getCell(4).value = `${percentage.toFixed(1)}%`;
    row.getCell(4).alignment = { horizontal: "center", vertical: "center" };
    row.getCell(4).font = { size: FONT_CONFIG.dataSize, name: FONT_CONFIG.standard, bold: index < 3 };

    [1, 2, 3, 4].forEach((col) => {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin", color: { argb: THEME_COLORS.border } },
        left: { style: "thin", color: { argb: THEME_COLORS.border } },
        bottom: { style: "thin", color: { argb: THEME_COLORS.border } },
        right: { style: "thin", color: { argb: THEME_COLORS.border } },
      };

      if (index < 3) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9E6" } };
      } else if (index % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME_COLORS.rowAlternate } };
      }
    });

    row.height = 22;
    currentRow++;
  });
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================
function formatDate(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDateString;
  }
}

function countBy(
  array: TicketData[],
  field: keyof TicketData
): Record<string, number> {
  return array.reduce((acc, item) => {
    const value = String(item[field] || "Não informado");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
