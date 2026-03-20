import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Save, Plus, Trash2, RefreshCw, AlertTriangle, Calendar, Timer, Zap, Info, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface ConfiguracaoSLA {
  id: number;
  prioridade: string;
  tempo_resposta_horas: number;
  tempo_resolucao_horas: number;
  percentual_risco: number;
  considera_horario_comercial: boolean;
  considera_feriados: boolean;
  escalar_automaticamente: boolean;
  notificar_em_risco: boolean;
  descricao: string | null;
  ativo: boolean;
}

interface HorarioComercial {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
}

interface Feriado {
  id: number;
  data: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  recorrente: boolean;
  ativo: boolean;
}

type TabType = "prioridades" | "horarios" | "feriados";

const DIAS_SEMANA = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

const TIPO_FERIADO: Record<string, string> = {
  nacional: "Nacional",
  ponto_facultativo: "Ponto Facultativo",
  estadual: "Estadual",
  municipio: "Municipal",
};

function fmtHoras(h: number): string {
  if (h <= 0) return "—";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r > 0 ? `${d}d ${r}h` : `${d}d`;
}

function fmtData(s: string): string {
  return new Date(s + "T00:00:00").toLocaleDateString("pt-BR");
}

// ─── PrioridadeCard ───────────────────────────────────────────────────────────

function PrioridadeCard({ config, onSave, onDelete }: {
  config: ConfiguracaoSLA;
  onSave: (id: number, data: Partial<ConfiguracaoSLA>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [respH, setRespH] = useState(String(config.tempo_resposta_horas));
  const [resH, setResH] = useState(String(config.tempo_resolucao_horas));
  const [risco, setRisco] = useState(String(config.percentual_risco));
  const [horComercial, setHorComercial] = useState(config.considera_horario_comercial);
  const [feriados, setFeriados] = useState(config.considera_feriados);
  const [escalar, setEscalar] = useState(config.escalar_automaticamente);
  const [notificar, setNotificar] = useState(config.notificar_em_risco);
  const [ativo, setAtivo] = useState(config.ativo);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(config.id, {
        tempo_resposta_horas: parseFloat(respH) || config.tempo_resposta_horas,
        tempo_resolucao_horas: parseFloat(resH) || config.tempo_resolucao_horas,
        percentual_risco: parseFloat(risco) || config.percentual_risco,
        considera_horario_comercial: horComercial,
        considera_feriados: feriados,
        escalar_automaticamente: escalar,
        notificar_em_risco: notificar,
        ativo,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{config.prioridade}</CardTitle>
            {!config.ativo && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(config.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
        {config.descricao && <CardDescription className="text-xs mt-1">{config.descricao}</CardDescription>}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Resposta (horas)</Label>
              <Input type="number" min={0.5} step={0.5} className="h-8 text-sm" value={respH} onChange={e => setRespH(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Resolução (horas)</Label>
              <Input type="number" min={1} step={0.5} className="h-8 text-sm" value={resH} onChange={e => setResH(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alerta de risco (%)</Label>
              <Input type="number" min={50} max={99} className="h-8 text-sm" value={risco} onChange={e => setRisco(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Opções</Label>
              {[
                { val: horComercial, set: setHorComercial, label: "Horário comercial" },
                { val: feriados,     set: setFeriados,     label: "Feriados" },
                { val: escalar,      set: setEscalar,      label: "Escalonamento auto" },
                { val: notificar,    set: setNotificar,     label: "Notificar em risco" },
                { val: ativo,        set: setAtivo,         label: "Ativo" },
              ].map(({ val, set, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Switch checked={val} onCheckedChange={set} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Timer className="h-3 w-3" />Resposta</div>
                <div className="text-lg font-bold">{fmtHoras(config.tempo_resposta_horas)}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Clock className="h-3 w-3" />Resolução</div>
                <div className="text-lg font-bold">{fmtHoras(config.tempo_resolucao_horas)}</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" />Risco</div>
                <div className="text-lg font-bold">{config.percentual_risco}%</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {config.considera_horario_comercial && <Badge variant="outline" className="text-xs font-normal"><Clock className="h-2.5 w-2.5 mr-1" />Horário comercial</Badge>}
              {config.considera_feriados && <Badge variant="outline" className="text-xs font-normal"><Calendar className="h-2.5 w-2.5 mr-1" />Feriados</Badge>}
              {config.escalar_automaticamente && <Badge variant="outline" className="text-xs font-normal"><Zap className="h-2.5 w-2.5 mr-1" />Escalonamento</Badge>}
              {config.notificar_em_risco && <Badge variant="outline" className="text-xs font-normal"><AlertTriangle className="h-2.5 w-2.5 mr-1" />Notificações</Badge>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── HorarioRow ───────────────────────────────────────────────────────────────

function HorarioRow({ horario, onSave }: {
  horario: HorarioComercial;
  onSave: (id: number, field: "hora_inicio" | "hora_fim" | "ativo", value: string | boolean) => Promise<void>;
}) {
  const [inicio, setInicio] = useState(horario.hora_inicio || "08:00");
  const [fim, setFim] = useState(horario.hora_fim || "18:00");
  const [dirty, setDirty] = useState(false);

  const save = async () => {
    await onSave(horario.id, "hora_inicio", inicio);
    await onSave(horario.id, "hora_fim", fim);
    setDirty(false);
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/30 transition-colors${!horario.ativo ? " opacity-50" : ""}`}>
      <span className="text-sm font-medium w-32 flex-shrink-0">{DIAS_SEMANA[horario.dia_semana] ?? `Dia ${horario.dia_semana}`}</span>
      <div className="flex items-center gap-2 flex-wrap flex-1">
        <Input type="time" value={inicio} disabled={!horario.ativo} className="h-8 w-28 text-sm"
          onChange={e => { setInicio(e.target.value); setDirty(true); }} />
        <span className="text-xs text-muted-foreground">até</span>
        <Input type="time" value={fim} disabled={!horario.ativo} className="h-8 w-28 text-sm"
          onChange={e => { setFim(e.target.value); setDirty(true); }} />
        {dirty && <Button size="sm" className="h-7 text-xs" onClick={save}><Save className="h-3 w-3 mr-1" />Salvar</Button>}
      </div>
      <Switch checked={horario.ativo} onCheckedChange={v => onSave(horario.id, "ativo", v)} />
    </div>
  );
}

// ─── SlaConfig ────────────────────────────────────────────────────────────────

export default function SlaConfig() {
  const [tab, setTab] = useState<TabType>("prioridades");
  const [configs, setConfigs] = useState<ConfiguracaoSLA[]>([]);
  const [horarios, setHorarios] = useState<HorarioComercial[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [anoFeriados, setAnoFeriados] = useState<number>(new Date().getFullYear());
  const [novaDialogOpen, setNovaDialogOpen] = useState(false);
  const [novaForm, setNovaForm] = useState({
    prioridade: "", tempo_resposta_horas: 4, tempo_resolucao_horas: 24, percentual_risco: 80,
    considera_horario_comercial: true, considera_feriados: true, escalar_automaticamente: false,
    notificar_em_risco: true, descricao: "", ativo: true,
  });
  const [feriadoDialogOpen, setFeriadoDialogOpen] = useState(false);
  const [feriadoForm, setFeriadoForm] = useState({ data: "", nome: "", descricao: "", tipo: "nacional", recorrente: false });

  const fetchConfigs = useCallback(async () => {
    try { const r = await apiFetch("/sla/configuracoes"); const d = await r.json(); setConfigs(Array.isArray(d) ? d : []); }
    catch { toast.error("Erro ao carregar configurações SLA"); }
  }, []);

  const fetchHorarios = useCallback(async () => {
    try { const r = await apiFetch("/sla/horario-comercial"); const d = await r.json(); setHorarios(Array.isArray(d) ? d : []); }
    catch { toast.error("Erro ao carregar horários"); }
  }, []);

  const fetchFeriados = useCallback(async () => {
    try { const r = await apiFetch(`/sla/feriados?ano=${anoFeriados}`); const d = await r.json(); setFeriados(Array.isArray(d) ? d : []); }
    catch { toast.error("Erro ao carregar feriados"); }
  }, [anoFeriados]);

  useEffect(() => { fetchConfigs(); fetchHorarios(); }, [fetchConfigs, fetchHorarios]);
  useEffect(() => { fetchFeriados(); }, [fetchFeriados]);

  const salvarConfig = async (id: number, data: Partial<ConfiguracaoSLA>): Promise<void> => {
    try {
      const r = await apiFetch(`/sla/configuracoes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      toast.success("Configuração salva"); fetchConfigs();
    } catch { toast.error("Erro ao salvar"); }
  };

  const deletarConfig = async (id: number): Promise<void> => {
    if (!confirm("Remover esta configuração?")) return;
    try { await apiFetch(`/sla/configuracoes/${id}`, { method: "DELETE" }); toast.success("Removida"); fetchConfigs(); }
    catch { toast.error("Erro ao remover"); }
  };

  const criarConfig = async () => {
    if (!novaForm.prioridade.trim()) { toast.error("Informe a prioridade"); return; }
    try {
      const r = await apiFetch("/sla/configuracoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(novaForm) });
      if (!r.ok) { const e = await r.json(); toast.error(e.detail || "Erro"); return; }
      toast.success("Criada"); setNovaDialogOpen(false);
      setNovaForm({ prioridade: "", tempo_resposta_horas: 4, tempo_resolucao_horas: 24, percentual_risco: 80,
        considera_horario_comercial: true, considera_feriados: true, escalar_automaticamente: false,
        notificar_em_risco: true, descricao: "", ativo: true });
      fetchConfigs();
    } catch { toast.error("Erro ao criar"); }
  };

  const salvarHorario = async (id: number, field: "hora_inicio" | "hora_fim" | "ativo", value: string | boolean): Promise<void> => {
    try {
      const r = await apiFetch(`/sla/horario-comercial/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      if (!r.ok) throw new Error();
      toast.success("Horário atualizado"); fetchHorarios();
    } catch { toast.error("Erro ao atualizar"); }
  };

  const criarFeriado = async () => {
    if (!feriadoForm.data || !feriadoForm.nome.trim()) { toast.error("Preencha data e nome"); return; }
    try {
      const r = await apiFetch("/sla/feriados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(feriadoForm) });
      if (!r.ok) throw new Error();
      toast.success("Feriado adicionado"); setFeriadoDialogOpen(false);
      setFeriadoForm({ data: "", nome: "", descricao: "", tipo: "nacional", recorrente: false });
      fetchFeriados();
    } catch { toast.error("Erro ao criar feriado"); }
  };

  const deletarFeriado = async (id: number) => {
    if (!confirm("Remover este feriado?")) return;
    try { await apiFetch(`/sla/feriados/${id}`, { method: "DELETE" }); toast.success("Removido"); fetchFeriados(); }
    catch { toast.error("Erro ao remover"); }
  };

  const gerarFeriados = async (sobrescrever = false) => {
    setLoadingGerar(true);
    try {
      const r = await apiFetch(`/sla/feriados/gerar/${anoFeriados}?sobrescrever=${sobrescrever}`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || "Erro desconhecido");
      }
      const d = await r.json();
      if (d.inseridos === 0 && d.duplicados > 0) {
        toast.success(`Feriados de ${anoFeriados} já existem (${d.duplicados} registros). Use "Sobrescrever" para substituí-los.`);
      } else {
        toast.success(`${d.inseridos} feriados inseridos${d.duplicados ? `, ${d.duplicados} já existiam` : ""}`);
      }
      fetchFeriados();
    } catch (e: any) { toast.error(`Erro ao gerar feriados: ${e.message || "tente novamente"}`); }
    finally { setLoadingGerar(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />Configurações de SLA
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie prazos, horário comercial e feriados.</p>
      </div>

      {/* Tabs */}
      <div className="tabs-scrollable border-b">
        {([ { key: "prioridades" as TabType, label: "Prioridades & Prazos", icon: <Zap className="h-4 w-4" /> },
            { key: "horarios"    as TabType, label: "Horário Comercial",     icon: <Clock className="h-4 w-4" /> },
            { key: "feriados"    as TabType, label: "Feriados",              icon: <Calendar className="h-4 w-4" /> },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Prioridades */}
      {tab === "prioridades" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Configure os limites de tempo para cada prioridade.</p>
            <Dialog open={novaDialogOpen} onOpenChange={setNovaDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Nova Prioridade</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Configuração de SLA</DialogTitle>
                  <DialogDescription>Defina os prazos para uma nova prioridade.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1">
                    <Label>Nome da Prioridade</Label>
                    <Input placeholder="Ex: Urgente, VIP..." value={novaForm.prioridade}
                      onChange={e => setNovaForm(f => ({ ...f, prioridade: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>Resposta (h)</Label>
                      <Input type="number" min={0.5} step={0.5} value={novaForm.tempo_resposta_horas}
                        onChange={e => setNovaForm(f => ({ ...f, tempo_resposta_horas: parseFloat(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Resolução (h)</Label>
                      <Input type="number" min={1} step={0.5} value={novaForm.tempo_resolucao_horas}
                        onChange={e => setNovaForm(f => ({ ...f, tempo_resolucao_horas: parseFloat(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Risco (%)</Label>
                      <Input type="number" min={50} max={99} value={novaForm.percentual_risco}
                        onChange={e => setNovaForm(f => ({ ...f, percentual_risco: parseFloat(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {([
                      { k: "considera_horario_comercial" as const, label: "Considerar horário comercial" },
                      { k: "considera_feriados"          as const, label: "Considerar feriados" },
                      { k: "escalar_automaticamente"     as const, label: "Escalar automaticamente" },
                      { k: "notificar_em_risco"          as const, label: "Notificar quando em risco" },
                    ]).map(({ k, label }) => (
                      <div key={k} className="flex items-center gap-3">
                        <Switch checked={novaForm[k]} onCheckedChange={v => setNovaForm(f => ({ ...f, [k]: v }))} />
                        <Label className="font-normal text-sm">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNovaDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={criarConfig}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {configs.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center">
              <Info className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma configuração. Crie prioridades para ativar o SLA.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {configs.map(cfg => <PrioridadeCard key={cfg.id} config={cfg} onSave={salvarConfig} onDelete={deletarConfig} />)}
            </div>
          )}
        </div>
      )}

      {/* Horários */}
      {tab === "horarios" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Fora do horário comercial o SLA fica pausado. Dias <strong>inativos</strong> funcionam como fim de semana.</span>
          </div>
          <Card>
            <div className="divide-y divide-border/40">
              {horarios.length === 0
                ? <div className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum horário. Padrão: 08:00–18:00 Seg–Sex.</div>
                : horarios.map(h => <HorarioRow key={h.id} horario={h} onSave={salvarHorario} />)
              }
            </div>
          </Card>
        </div>
      )}

      {/* Feriados */}
      {tab === "feriados" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label>Ano:</Label>
              <Input type="number" value={anoFeriados} min={2024} max={2030} className="w-24 h-8 text-sm"
                onChange={e => setAnoFeriados(parseInt(e.target.value))} />
              <Badge variant="secondary">{feriados.length} feriados</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => gerarFeriados(false)} disabled={loadingGerar}>
                {loadingGerar ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />}
                Gerar {anoFeriados}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => gerarFeriados(true)} disabled={loadingGerar}
                title="Apaga os feriados existentes e regera do zero">
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Sobrescrever
              </Button>
              <Dialog open={feriadoDialogOpen} onOpenChange={setFeriadoDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Adicionar</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Novo Feriado</DialogTitle>
                    <DialogDescription>Adicione um feriado que pausará o SLA.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Data</Label>
                        <Input type="date" value={feriadoForm.data} onChange={e => setFeriadoForm(f => ({ ...f, data: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Tipo</Label>
                        <Select value={feriadoForm.tipo} onValueChange={v => setFeriadoForm(f => ({ ...f, tipo: v }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nacional">Nacional</SelectItem>
                            <SelectItem value="estadual">Estadual</SelectItem>
                            <SelectItem value="municipio">Municipal</SelectItem>
                            <SelectItem value="ponto_facultativo">Ponto Facultativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Nome</Label>
                      <Input placeholder="Ex: Natal..." value={feriadoForm.nome} onChange={e => setFeriadoForm(f => ({ ...f, nome: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={feriadoForm.recorrente} onCheckedChange={v => setFeriadoForm(f => ({ ...f, recorrente: v }))} />
                      <Label className="font-normal text-sm">Recorrente (repete todo ano)</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setFeriadoDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={criarFeriado}>Adicionar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Recorrente</th>
                  <th className="px-4 py-3 w-12" />
                </tr></thead>
                <tbody>
                  {feriados.length === 0
                    ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum feriado para {anoFeriados}. Use "Gerar {anoFeriados}".
                      </td></tr>
                    : feriados.map(f => (
                        <tr key={f.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono">{fmtData(f.data)}</td>
                          <td className="px-4 py-3 font-medium">{f.nome}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{TIPO_FERIADO[f.tipo] ?? f.tipo}</Badge></td>
                          <td className="px-4 py-3 text-center">
                            {f.recorrente
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              : <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                          </td>
                          <td className="px-4 py-3">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deletarFeriado(f.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border/40">
              {feriados.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Nenhum feriado para {anoFeriados}.
                </div>
              ) : feriados.map(f => (
                <div key={f.id} className="p-3 flex items-start justify-between gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{f.nome}</div>
                    <div className="text-xs text-muted-foreground font-mono">{fmtData(f.data)}</div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{TIPO_FERIADO[f.tipo] ?? f.tipo}</Badge>
                      {f.recorrente && <Badge variant="secondary" className="text-xs">Recorrente</Badge>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0" onClick={() => deletarFeriado(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
