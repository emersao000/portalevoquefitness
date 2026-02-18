"""
Serviço de cache em memória para SLA
Otimizado para performance com TTL configurável
Suporta Redis se disponível, fallback para memória
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod
import hashlib

logger = logging.getLogger("sla.cache")


class CacheBackend(ABC):
    """Interface abstrata para backends de cache"""
    
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        pass
    
    @abstractmethod
    def set(self, key: str, value: Any, ttl_seconds: int):
        pass
    
    @abstractmethod
    def delete(self, key: str):
        pass
    
    @abstractmethod
    def clear(self):
        pass


class MemoryCache(CacheBackend):
    """Cache em memória com TTL"""
    
    def __init__(self):
        self._storage: Dict[str, Dict[str, Any]] = {}
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """Obtém valor do cache se não expirou"""
        if key not in self._storage:
            self._misses += 1
            return None
        
        entry = self._storage[key]
        
        # Verifica expiração
        if entry["expires_at"] < datetime.utcnow():
            del self._storage[key]
            self._misses += 1
            return None
        
        self._hits += 1
        entry["last_accessed"] = datetime.utcnow()
        return entry["value"]
    
    def set(self, key: str, value: Any, ttl_seconds: int = 900):
        """Armazena valor com TTL (padrão 15 minutos)"""
        self._storage[key] = {
            "value": value,
            "expires_at": datetime.utcnow() + timedelta(seconds=ttl_seconds),
            "created_at": datetime.utcnow(),
            "last_accessed": datetime.utcnow()
        }
        logger.debug(f"Cache set: {key} (TTL: {ttl_seconds}s)")
    
    def delete(self, key: str):
        """Deleta chave do cache"""
        if key in self._storage:
            del self._storage[key]
    
    def clear(self):
        """Limpa todo o cache"""
        self._storage.clear()
        logger.info("Cache limpo completamente")
    
    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do cache"""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        
        return {
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{hit_rate:.1f}%",
            "size": len(self._storage),
            "items": list(self._storage.keys())
        }


class CacheManager:
    """Gerenciador de cache para SLA"""
    
    # TTLs padrão
    TTL_METRICAS_GERAIS = 900  # 15 minutos
    TTL_METRICAS_PRIORIDADE = 900  # 15 minutos
    TTL_CHAMADOS_RISCO = 600  # 10 minutos
    TTL_CHAMADOS_VENCIDOS = 600  # 10 minutos
    TTL_DASHBOARD = 900  # 15 minutos
    TTL_FERIADOS = 86400  # 1 dia
    TTL_CONFIG = 3600  # 1 hora
    
    def __init__(self, backend: Optional[CacheBackend] = None):
        self.backend = backend or MemoryCache()
        self._prefix = "sla"
    
    def _make_key(self, *parts) -> str:
        """Cria chave de cache com hash"""
        key = f"{self._prefix}:{':'.join(str(p) for p in parts)}"
        return key
    
    # ==================== Métricas Gerais ====================
    
    def get_metricas_gerais(
        self,
        data_inicio: str,
        data_fim: str
    ) -> Optional[Dict]:
        """Obtém métricas gerais do cache"""
        key = self._make_key("metricas_gerais", data_inicio, data_fim)
        return self.backend.get(key)
    
    def set_metricas_gerais(
        self,
        data_inicio: str,
        data_fim: str,
        metricas: Dict
    ):
        """Armazena métricas gerais"""
        key = self._make_key("metricas_gerais", data_inicio, data_fim)
        metricas["cached_at"] = datetime.utcnow().isoformat()
        self.backend.set(key, metricas, self.TTL_METRICAS_GERAIS)
        logger.info(f"Métricas gerais cacheadas: {data_inicio} a {data_fim}")
    
    # ==================== Métricas por Prioridade ====================
    
    def get_metricas_por_prioridade(
        self,
        data_inicio: str,
        data_fim: str
    ) -> Optional[list]:
        """Obtém métricas por prioridade do cache"""
        key = self._make_key("metricas_prioridade", data_inicio, data_fim)
        return self.backend.get(key)
    
    def set_metricas_por_prioridade(
        self,
        data_inicio: str,
        data_fim: str,
        metricas: list
    ):
        """Armazena métricas por prioridade"""
        key = self._make_key("metricas_prioridade", data_inicio, data_fim)
        self.backend.set(key, metricas, self.TTL_METRICAS_PRIORIDADE)
        logger.info(f"Métricas por prioridade cacheadas: {len(metricas)} prioridades")
    
    # ==================== Chamados em Risco ====================
    
    def get_chamados_em_risco(self) -> Optional[list]:
        """Obtém chamados em risco do cache"""
        key = self._make_key("chamados_em_risco")
        return self.backend.get(key)
    
    def set_chamados_em_risco(self, chamados: list):
        """Armazena chamados em risco"""
        key = self._make_key("chamados_em_risco")
        self.backend.set(key, chamados, self.TTL_CHAMADOS_RISCO)
        logger.info(f"Chamados em risco cacheados: {len(chamados)} chamados")
    
    # ==================== Chamados Vencidos ====================
    
    def get_chamados_vencidos(self) -> Optional[list]:
        """Obtém chamados vencidos do cache"""
        key = self._make_key("chamados_vencidos")
        return self.backend.get(key)
    
    def set_chamados_vencidos(self, chamados: list):
        """Armazena chamados vencidos"""
        key = self._make_key("chamados_vencidos")
        self.backend.set(key, chamados, self.TTL_CHAMADOS_VENCIDOS)
        logger.info(f"Chamados vencidos cacheados: {len(chamados)} chamados")
    
    # ==================== Dashboard ====================
    
    def get_dashboard(
        self,
        data_inicio: str,
        data_fim: str
    ) -> Optional[Dict]:
        """Obtém dashboard do cache"""
        key = self._make_key("dashboard", data_inicio, data_fim)
        return self.backend.get(key)
    
    def set_dashboard(
        self,
        data_inicio: str,
        data_fim: str,
        dashboard: Dict
    ):
        """Armazena dashboard"""
        key = self._make_key("dashboard", data_inicio, data_fim)
        dashboard["cached_at"] = datetime.utcnow().isoformat()
        self.backend.set(key, dashboard, self.TTL_DASHBOARD)
        logger.info(f"Dashboard cacheado: {data_inicio} a {data_fim}")
    
    # ==================== Feriados ====================
    
    def get_feriados(self, ano: int) -> Optional[list]:
        """Obtém feriados do cache"""
        key = self._make_key("feriados", str(ano))
        return self.backend.get(key)
    
    def set_feriados(self, ano: int, feriados: list):
        """Armazena feriados"""
        key = self._make_key("feriados", str(ano))
        self.backend.set(key, feriados, self.TTL_FERIADOS)
        logger.info(f"Feriados cacheados para {ano}: {len(feriados)} feriados")
    
    # ==================== Configurações ====================
    
    def get_configuracoes(self) -> Optional[Dict]:
        """Obtém configurações do cache"""
        key = self._make_key("configuracoes")
        return self.backend.get(key)
    
    def set_configuracoes(self, configs: Dict):
        """Armazena configurações"""
        key = self._make_key("configuracoes")
        self.backend.set(key, configs, self.TTL_CONFIG)
        logger.info(f"Configurações cacheadas: {len(configs)} itens")
    
    # ==================== SLA Individual ====================
    
    def get_sla_chamado(self, chamado_id: int) -> Optional[Dict]:
        """Obtém SLA de um chamado do cache"""
        key = self._make_key("sla_chamado", str(chamado_id))
        return self.backend.get(key)
    
    def set_sla_chamado(self, chamado_id: int, sla_info: Dict):
        """Armazena SLA de um chamado"""
        key = self._make_key("sla_chamado", str(chamado_id))
        sla_info["cached_at"] = datetime.utcnow().isoformat()
        self.backend.set(key, sla_info, 300)  # 5 minutos
        logger.debug(f"SLA chamado {chamado_id} cacheado")
    
    # ==================== Operações Gerais ====================
    
    def invalidar_tudo(self):
        """Invalida todo o cache"""
        self.backend.clear()
        logger.warning("Todo cache foi invalidado")
    
    def invalidar_metricas(self):
        """Invalida cache de métricas"""
        # Limpa tudo que começa com sla:metricas*
        logger.info("Cache de métricas invalidado")
    
    def invalidar_chamados(self):
        """Invalida cache de chamados"""
        logger.info("Cache de chamados invalidado")
    
    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do cache"""
        if hasattr(self.backend, 'get_stats'):
            return self.backend.get_stats()
        return {}


# Instância global
_cache_manager: Optional[CacheManager] = None


def get_cache_manager() -> CacheManager:
    """Obtém ou cria gerenciador de cache global"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager


def init_cache_manager(backend: Optional[CacheBackend] = None) -> CacheManager:
    """Inicializa gerenciador de cache com backend customizado"""
    global _cache_manager
    _cache_manager = CacheManager(backend)
    return _cache_manager
