"""Exceções customizadas do módulo SLA"""


class SlaException(Exception):
    """Exceção base do módulo SLA"""
    pass


class ConfiguracaoDuplicadaError(SlaException):
    """Erro quando tenta criar configuração duplicada"""
    def __init__(self, prioridade: str):
        self.prioridade = prioridade
        super().__init__(f"Já existe configuração ativa para prioridade '{prioridade}'")


class FeriadoDuplicadoError(SlaException):
    """Erro quando tenta criar feriado duplicado"""
    def __init__(self, data: str):
        self.data = data
        super().__init__(f"Já existe feriado cadastrado para a data '{data}'")


class ChamadoNaoEncontradoError(SlaException):
    """Erro quando chamado não é encontrado"""
    def __init__(self, chamado_id: int):
        self.chamado_id = chamado_id
        super().__init__(f"Chamado {chamado_id} não encontrado")


class ConfiguracaoNaoEncontradaError(SlaException):
    """Erro quando configuração não é encontrada"""
    def __init__(self, prioridade: str):
        self.prioridade = prioridade
        super().__init__(f"Configuração para prioridade '{prioridade}' não encontrada")


class HorarioInvalidoError(SlaException):
    """Erro quando horário comercial é inválido"""
    def __init__(self, hora_inicio: int, hora_fim: int):
        super().__init__(
            f"Horário inválido: início ({hora_inicio}) deve ser menor que fim ({hora_fim})"
        )
