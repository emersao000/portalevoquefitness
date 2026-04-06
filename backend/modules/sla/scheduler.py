"""
Scheduler automático para atualizar SLA a cada 15 minutos
Usa APScheduler para executar em background
"""
import logging
from datetime import datetime, date, timedelta
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from .calculator import CalculadorSLA
from .metrics import ServicoMetricasSLA
from .cache_service import get_cache_manager

logger = logging.getLogger("sla.scheduler")


class SchedulerSLA:
    """Gerenciador de scheduler para atualizações automáticas de SLA"""
    
    def __init__(self):
        self.scheduler: Optional[BackgroundScheduler] = None
        self.is_running = False
        self.job_id = "sla_update_job"
        self.update_interval_minutes = 15  # 15 minutos
    
    def iniciar(self, db_session_factory, update_interval: int = 15):
        """
        Inicia o scheduler
        
        Args:
            db_session_factory: Factory para criar sessões de banco
            update_interval: Intervalo em minutos (padrão 15)
        """
        if self.is_running:
            logger.warning("Scheduler SLA já está em execução")
            return
        
        try:
            self.scheduler = BackgroundScheduler()
            self.update_interval_minutes = update_interval
            
            # Adiciona job para atualizar SLA
            self.scheduler.add_job(
                func=self._atualizar_sla,
                trigger=IntervalTrigger(minutes=update_interval),
                id=self.job_id,
                name="Atualização de SLA",
                replace_existing=True,
                kwargs={"db_session_factory": db_session_factory}
            )
            
            # Inicia scheduler
            self.scheduler.start()
            self.is_running = True
            
            logger.info(f"✅ Scheduler SLA iniciado (intervalo: {update_interval}m)")
            
            # Executa primeira atualização imediatamente
            db = db_session_factory()
            try:
                self._atualizar_sla(db_session_factory)
            finally:
                db.close()
        
        except Exception as e:
            logger.error(f"❌ Erro ao iniciar scheduler: {e}")
            self.is_running = False
    
    def parar(self):
        """Para o scheduler"""
        if self.scheduler and self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("⏹️ Scheduler SLA parado")
    
    def _atualizar_sla(self, db_session_factory):
        """
        Função executada periodicamente para atualizar SLA
        Atualiza cache com novos cálculos
        """
        inicio = datetime.utcnow()
        logger.info(f"🔄 Iniciando atualização de SLA...")
        
        db = db_session_factory()
        
        try:
            cache = get_cache_manager()
            
            # 1. Recalcula todos os SLAs
            calculator = CalculadorSLA(db)
            stats = calculator.recalcular_todos()
            logger.info(f"✅ SLAs recalculados: {stats['total_processados']} chamados em {stats['tempo_ms']}ms")
            
            # 2. Atualiza cache de métricas
            servico = ServicoMetricasSLA(db)
            
            # Múltiplos períodos
            periodos = [
                (date.today() - timedelta(days=7), date.today(), "7dias"),
                (date.today() - timedelta(days=30), date.today(), "30dias"),
                (date.today() - timedelta(days=60), date.today(), "60dias"),
                (date.today() - timedelta(days=90), date.today(), "90dias"),
            ]
            
            for data_inicio, data_fim, label in periodos:
                metricas = servico.obter_metricas_gerais(data_inicio, data_fim)
                cache.set_metricas_gerais(
                    str(data_inicio),
                    str(data_fim),
                    metricas
                )
                logger.debug(f"📊 Métricas cacheadas: {label}")
            
            # 3. Atualiza cache de chamados em risco
            em_risco = servico.obter_chamados_em_risco(limite=50)
            cache.set_chamados_em_risco(em_risco)
            
            # 4. Atualiza cache de chamados vencidos
            vencidos = servico.obter_chamados_vencidos(limite=50)
            cache.set_chamados_vencidos(vencidos)
            
            # 5. Atualiza cache de dashboard
            dashboard = servico.obter_dashboard_executivo()
            cache.set_dashboard(
                str(date.today() - timedelta(days=30)),
                str(date.today()),
                dashboard
            )
            
            tempo_total = (datetime.utcnow() - inicio).total_seconds() * 1000
            logger.info(f"✅ Atualização concluída em {tempo_total:.0f}ms")
            logger.info(f"   - {stats['em_risco']} em risco, {stats['vencidos']} vencidos, {stats['pausados']} pausados")
        
        except Exception as e:
            logger.error(f"❌ Erro ao atualizar SLA: {e}", exc_info=True)
        
        finally:
            db.close()
    
    def atualizar_manualmente(self, db_session_factory):
        """
        Atualiza SLA manualmente (disparado por botão no frontend)
        """
        logger.info("🔄 Atualização manual de SLA solicitada")
        self._atualizar_sla(db_session_factory)
    
    def get_status(self) -> dict:
        """Retorna status do scheduler"""
        if not self.scheduler:
            return {
                "running": False,
                "message": "Scheduler não iniciado"
            }
        
        job = self.scheduler.get_job(self.job_id)
        
        if not job:
            return {
                "running": False,
                "message": "Job não encontrado"
            }
        
        return {
            "running": self.is_running,
            "job_id": self.job_id,
            "interval_minutes": self.update_interval_minutes,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "last_execution": None  # Pode ser rastreado adicionando callback
        }


# Instância global
_scheduler: Optional[SchedulerSLA] = None


def get_scheduler() -> SchedulerSLA:
    """Obtém ou cria scheduler global"""
    global _scheduler
    if _scheduler is None:
        _scheduler = SchedulerSLA()
    return _scheduler


def iniciar_scheduler(db_session_factory, update_interval: int = 15):
    """Inicia scheduler global"""
    scheduler = get_scheduler()
    scheduler.iniciar(db_session_factory, update_interval)
    return scheduler


def parar_scheduler():
    """Para scheduler global"""
    scheduler = get_scheduler()
    scheduler.parar()
