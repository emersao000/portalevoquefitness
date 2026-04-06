"""Cache em memória para dados de SLA"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger("sla.cache")


class SlaCache:
    """Cache singleton para dados de SLA"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_cache()
        return cls._instance
    
    def _init_cache(self):
        """Inicializa estruturas do cache"""
        self._feriados: Optional[List] = None
        self._feriados_timestamp: Optional[datetime] = None
        self._configs: Optional[Dict] = None
        self._configs_timestamp: Optional[datetime] = None
        self._ttl_minutes = 60  # TTL padrão de 60 minutos
    
    def _is_valid(self, timestamp: Optional[datetime]) -> bool:
        """Verifica se o cache ainda é válido"""
        if timestamp is None:
            return False
        return datetime.now() - timestamp < timedelta(minutes=self._ttl_minutes)
    
    # ========== Feriados ==========
    
    def get_feriados(self) -> Optional[List]:
        """Retorna feriados do cache se válido"""
        if self._is_valid(self._feriados_timestamp):
            logger.debug("Cache de feriados HIT")
            return self._feriados
        logger.debug("Cache de feriados MISS")
        return None
    
    def set_feriados(self, feriados: List) -> None:
        """Armazena feriados no cache"""
        self._feriados = feriados
        self._feriados_timestamp = datetime.now()
        logger.info(f"Cache de feriados atualizado: {len(feriados)} registros")
    
    def invalidate_feriados(self) -> None:
        """Invalida cache de feriados"""
        self._feriados = None
        self._feriados_timestamp = None
        logger.info("Cache de feriados invalidado")
    
    # ========== Configurações ==========
    
    def get_configs(self) -> Optional[Dict]:
        """Retorna configs do cache se válido"""
        if self._is_valid(self._configs_timestamp):
            logger.debug("Cache de configs HIT")
            return self._configs
        logger.debug("Cache de configs MISS")
        return None
    
    def set_configs(self, configs: Dict) -> None:
        """Armazena configs no cache"""
        self._configs = configs
        self._configs_timestamp = datetime.now()
        logger.info(f"Cache de configs atualizado: {len(configs)} registros")
    
    def invalidate_configs(self) -> None:
        """Invalida cache de configs"""
        self._configs = None
        self._configs_timestamp = None
        logger.info("Cache de configs invalidado")
    
    # ========== Geral ==========
    
    def invalidate_all(self) -> None:
        """Invalida todo o cache"""
        self.invalidate_feriados()
        self.invalidate_configs()
        logger.info("Cache completamente invalidado")
    
    def get_status(self) -> Dict[str, Any]:
        """Retorna status do cache"""
        return {
            "feriados": {
                "cached": self._feriados is not None,
                "count": len(self._feriados) if self._feriados else 0,
                "valid": self._is_valid(self._feriados_timestamp),
                "ttl_minutes": self._ttl_minutes
            },
            "configs": {
                "cached": self._configs is not None,
                "count": len(self._configs) if self._configs else 0,
                "valid": self._is_valid(self._configs_timestamp),
                "ttl_minutes": self._ttl_minutes
            }
        }
