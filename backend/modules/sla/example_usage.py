"""
Exemplos práticos de uso do módulo SLA
Execute para testar o sistema
"""
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session

from .calculator import CalculadorSLA
from .metrics import ServicoMetricasSLA
from .models import Chamado, ConfiguracaoSLA, Feriado


def exemplo_calcular_sla(db: Session):
    """Exemplo 1: Calcular SLA de um chamado específico"""
    print("\n" + "="*60)
    print("EXEMPLO 1: Cálculo de SLA de um chamado")
    print("="*60)
    
    # Busca um chamado
    chamado = db.query(Chamado).first()
    
    if not chamado:
        print("❌ Nenhum chamado encontrado no banco")
        return
    
    # Cria calculadora
    calculator = CalculadorSLA(db)
    
    # Calcula SLA
    resultado = calculator.calcular_sla(chamado)
    
    print(f"\n📋 Chamado: {chamado.codigo}")
    print(f"   Prioridade: {chamado.prioridade}")
    print(f"   Status: {chamado.status}")
    print(f"   Data abertura: {chamado.data_abertura}")
    
    print(f"\n⏱️ Resposta (1ª resposta):")
    print(f"   Limite: {resultado['tempo_resposta_limite_horas']}h")
    print(f"   Decorrido: {resultado['tempo_resposta_decorrido_horas']}h")
    print(f"   Pausado: {resultado['tempo_resposta_pausado_horas']}h")
    print(f"   Percentual: {resultado['percentual_resposta']}%")
    print(f"   Status: {'✅ Em dia' if resultado['resposta_em_dia'] else '⚠️ Em risco' if resultado['resposta_em_risco'] else '❌ Vencido'}")
    
    print(f"\n⏱️ Resolução (conclusão):")
    print(f"   Limite: {resultado['tempo_resolucao_limite_horas']}h")
    print(f"   Decorrido: {resultado['tempo_resolucao_decorrido_horas']}h")
    print(f"   Pausado: {resultado['tempo_resolucao_pausado_horas']}h")
    print(f"   Percentual: {resultado['percentual_resolucao']}%")
    print(f"   Status: {'✅ Em dia' if resultado['resolucao_em_dia'] else '⚠️ Em risco' if resultado['resolucao_em_risco'] else '❌ Vencido'}")
    
    print(f"\n📊 Outros:")
    print(f"   Pausado: {'Sim' if resultado['pausado'] else 'Não'}")
    print(f"   Ativo: {'Sim' if resultado['ativo'] else 'Não'}")


def exemplo_metricas_gerais(db: Session):
    """Exemplo 2: Obter métricas gerais de SLA"""
    print("\n" + "="*60)
    print("EXEMPLO 2: Métricas gerais de SLA")
    print("="*60)
    
    servico = ServicoMetricasSLA(db)
    
    # Últimos 30 dias
    data_fim = date.today()
    data_inicio = data_fim - timedelta(days=30)
    
    metricas = servico.obter_metricas_gerais(data_inicio, data_fim)
    
    print(f"\n📊 Período: {data_inicio} a {data_fim}")
    print(f"\n👥 Totais:")
    print(f"   Chamados: {metricas['total_chamados']}")
    print(f"   Abertos: {metricas['chamados_abertos']}")
    print(f"   Concluídos: {metricas['chamados_concluidos']}")
    print(f"   Pausados: {metricas['chamados_pausados']}")
    
    print(f"\n⚠️ Alertas:")
    print(f"   Em risco: {metricas['chamados_em_risco']} ({metricas['percentual_em_risco']}%)")
    print(f"   Vencidos: {metricas['chamados_vencidos']} ({metricas['percentual_vencidos']}%)")
    
    print(f"\n✅ Taxa de cumprimento: {metricas['percentual_cumprimento']}%")
    
    print(f"\n⏱️ Médias:")
    print(f"   Tempo resposta: {metricas['tempo_medio_resposta_horas']:.2f}h")
    print(f"   Tempo resolução: {metricas['tempo_medio_resolucao_horas']:.2f}h")


def exemplo_metricas_por_prioridade(db: Session):
    """Exemplo 3: Métricas agrupadas por prioridade"""
    print("\n" + "="*60)
    print("EXEMPLO 3: Métricas por prioridade")
    print("="*60)
    
    servico = ServicoMetricasSLA(db)
    metricas = servico.obter_metricas_por_prioridade()
    
    if not metricas:
        print("❌ Sem dados para mostrar")
        return
    
    print()
    for m in metricas:
        print(f"🔹 {m['prioridade']}")
        print(f"   Total: {m['total']}")
        print(f"   Em risco: {m['em_risco']} ({m['percentual_em_risco']}%)")
        print(f"   Vencidos: {m['vencidos']} ({m['percentual_vencidos']}%)")
        print(f"   Pausados: {m['pausados']}")
        print(f"   Tempo médio resposta: {m['tempo_medio_resposta_horas']:.2f}h")
        print(f"   Tempo médio resolução: {m['tempo_medio_resolucao_horas']:.2f}h")
        print()


def exemplo_chamados_em_risco(db: Session):
    """Exemplo 4: Obter chamados em risco"""
    print("\n" + "="*60)
    print("EXEMPLO 4: Chamados em risco (80%+ do SLA consumido)")
    print("="*60)
    
    servico = ServicoMetricasSLA(db)
    em_risco = servico.obter_chamados_em_risco(limite=10)
    
    if not em_risco:
        print("\n✅ Nenhum chamado em risco!")
        return
    
    print(f"\n⚠️ Total: {len(em_risco)} chamados\n")
    
    for i, chamado in enumerate(em_risco, 1):
        print(f"{i}. {chamado['codigo']} ({chamado['prioridade']})")
        print(f"   Status: {chamado['status']}")
        print(f"   Consumido: {chamado['percentual_resolucao']:.1f}%")
        print(f"   Tempo: {chamado['tempo_decorrido_horas']:.2f}h / {chamado['tempo_limite_horas']:.2f}h")
        print()


def exemplo_chamados_vencidos(db: Session):
    """Exemplo 5: Obter chamados vencidos"""
    print("\n" + "="*60)
    print("EXEMPLO 5: Chamados vencidos (SLA expirado)")
    print("="*60)
    
    servico = ServicoMetricasSLA(db)
    vencidos = servico.obter_chamados_vencidos(limite=10)
    
    if not vencidos:
        print("\n✅ Nenhum chamado vencido!")
        return
    
    print(f"\n❌ Total: {len(vencidos)} chamados\n")
    
    for i, chamado in enumerate(vencidos, 1):
        tempo_vencimento = chamado['tempo_vencimento_horas']
        print(f"{i}. {chamado['codigo']} ({chamado['prioridade']})")
        print(f"   Status: {chamado['status']}")
        print(f"   Vencido há: {abs(tempo_vencimento):.2f}h")
        print(f"   Tempo: {chamado['tempo_decorrido_horas']:.2f}h / {chamado['tempo_limite_horas']:.2f}h")
        print()


def exemplo_dashboard_executivo(db: Session):
    """Exemplo 6: Dashboard executivo completo"""
    print("\n" + "="*60)
    print("EXEMPLO 6: Dashboard executivo")
    print("="*60)
    
    servico = ServicoMetricasSLA(db)
    dashboard = servico.obter_dashboard_executivo()
    
    print(f"\n📊 Atualizado em: {dashboard['timestamp']}")
    
    # Métricas gerais
    met = dashboard['metricas_gerais']
    print(f"\n📈 Métricas Gerais:")
    print(f"   Total: {met['total_chamados']} chamados")
    print(f"   Taxa cumprimento: {met['percentual_cumprimento']}%")
    print(f"   Em risco: {met['chamados_em_risco']}")
    print(f"   Vencidos: {met['chamados_vencidos']}")
    
    # Alertas
    alertas = dashboard['alertas']
    print(f"\n🔔 Alertas:")
    print(f"   Total: {alertas['total_alertas']}")
    
    # Observações
    print(f"\n💡 Observações:")
    for obs in dashboard['observacoes']:
        print(f"   {obs}")


def exemplo_feriados(db: Session):
    """Exemplo 7: Informações sobre feriados"""
    print("\n" + "="*60)
    print("EXEMPLO 7: Feriados configurados")
    print("="*60)
    
    # Busca feriados do ano atual
    ano = date.today().year
    feriados = db.query(Feriado).filter(
        Feriado.data >= date(ano, 1, 1),
        Feriado.data <= date(ano, 12, 31),
        Feriado.ativo == True
    ).order_by(Feriado.data).limit(10).all()
    
    if not feriados:
        print(f"\n❌ Sem feriados configurados para {ano}")
        return
    
    print(f"\n📅 Próximos feriados de {ano}:\n")
    
    for f in feriados[:10]:
        tipo_label = "🔒 Fixo" if f.recorrente else "🔄 Móvel"
        print(f"{f.data.strftime('%d/%m')} - {f.nome} ({tipo_label})")


def exemplo_configuracoes_sla(db: Session):
    """Exemplo 8: Configurações de SLA por prioridade"""
    print("\n" + "="*60)
    print("EXEMPLO 8: Configurações de SLA")
    print("="*60)
    
    configs = db.query(ConfiguracaoSLA).filter(
        ConfiguracaoSLA.ativo == True
    ).all()
    
    if not configs:
        print("\n❌ Sem configurações de SLA")
        return
    
    print()
    for config in configs:
        print(f"🔹 {config.prioridade}")
        print(f"   Resposta: {config.tempo_resposta_horas}h")
        print(f"   Resolução: {config.tempo_resolucao_horas}h")
        print(f"   Alerta: {config.percentual_risco}%")
        print(f"   Comercial: {'Sim' if config.considera_horario_comercial else 'Não'}")
        print(f"   Feriados: {'Sim' if config.considera_feriados else 'Não'}")
        print()


def executar_todos_exemplos(db: Session):
    """Executa todos os exemplos"""
    print("\n")
    print("╔" + "="*58 + "╗")
    print("║" + " "*10 + "EXEMPLOS DE USO DO MÓDULO SLA" + " "*20 + "║")
    print("╚" + "="*58 + "╝")
    
    try:
        exemplo_calcular_sla(db)
        exemplo_configuracoes_sla(db)
        exemplo_feriados(db)
        exemplo_metricas_gerais(db)
        exemplo_metricas_por_prioridade(db)
        exemplo_chamados_em_risco(db)
        exemplo_chamados_vencidos(db)
        exemplo_dashboard_executivo(db)
        
        print("\n" + "="*60)
        print("✅ Todos os exemplos executados com sucesso!")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n❌ Erro ao executar exemplos: {e}")
        import traceback
        traceback.print_exc()


# Instruções de uso
if __name__ == "__main__":
    print("""
    Para usar os exemplos:
    
    from sqlalchemy.orm import Session
    from seu_projeto.database import SessionLocal
    from backend.modules.sla.example_usage import executar_todos_exemplos
    
    db = SessionLocal()
    executar_todos_exemplos(db)
    db.close()
    """)
