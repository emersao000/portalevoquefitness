"""
Cálculo de feriados brasileiros: fixos e móveis (baseados na Páscoa)
"""
from datetime import date, timedelta
from typing import List, Dict
from dateutil.easter import easter


def calcular_feriados_fixos(ano: int) -> List[Dict[str, str]]:
    """
    Retorna lista de feriados fixos (mesma data todo ano) para um ano específico
    
    Args:
        ano: Ano desejado
    
    Returns:
        Lista com dicts contendo data, nome e tipo
    """
    return [
        {
            "data": f"{ano}-01-01",
            "nome": "Confraternização Universal",
            "tipo": "nacional",
            "recorrente": True
        },
        {
            "data": f"{ano}-04-21",
            "nome": "Tiradentes",
            "tipo": "nacional",
            "recorrente": True
        },
        {
            "data": f"{ano}-05-01",
            "nome": "Dia do Trabalho",
            "tipo": "nacional",
            "recorrente": True
        },
        {
            "data": f"{ano}-09-07",
            "nome": "Independência do Brasil",
            "tipo": "nacional",
            "recorrente": True
        },
        {
            "data": f"{ano}-10-12",
            "nome": "Nossa Senhora Aparecida",
            "tipo": "nacional",
            "recorrente": True
        },
        {
            "data": f"{ano}-11-02",
            "nome": "Finados",
            "tipo": "nacional",
            "recorrente": True
        },
        {
            "data": f"{ano}-11-15",
            "nome": "Proclamação da República",
            "tipo": "nacional",
            "recorrente": True
        },
        {
            "data": f"{ano}-11-20",
            "nome": "Dia da Consciência Negra",
            "tipo": "nacional",
            "recorrente": True
        },
        {
            "data": f"{ano}-12-25",
            "nome": "Natal",
            "tipo": "nacional",
            "recorrente": True
        },
        # Pontos facultativos
        {
            "data": f"{ano}-10-28",
            "nome": "Dia do Servidor Público",
            "tipo": "ponto_facultativo",
            "recorrente": True
        },
        {
            "data": f"{ano}-12-24",
            "nome": "Véspera de Natal (após 14h)",
            "tipo": "ponto_facultativo",
            "recorrente": True
        },
        {
            "data": f"{ano}-12-31",
            "nome": "Véspera de Ano Novo (após 14h)",
            "tipo": "ponto_facultativo",
            "recorrente": True
        },
    ]


def calcular_feriados_moveis(ano: int) -> List[Dict[str, str]]:
    """
    Calcula feriados móveis (que mudam conforme Páscoa) para um ano específico
    
    Args:
        ano: Ano desejado
    
    Returns:
        Lista com dicts contendo data, nome e tipo
    
    Referência:
        - Carnaval: 47 dias antes da Páscoa
        - Quarta de Cinzas: 46 dias antes da Páscoa (até 14h)
        - Sexta-feira Santa: 2 dias antes da Páscoa
        - Páscoa: varia entre 22/março e 25/abril
        - Corpus Christi: 60 dias depois da Páscoa
    """
    pascoa = easter(ano)
    feriados = []
    
    # Carnaval (domingo): 49 dias antes da Páscoa
    carnaval_domingo = pascoa - timedelta(days=49)
    feriados.append({
        "data": carnaval_domingo.strftime("%Y-%m-%d"),
        "nome": "Domingo de Carnaval",
        "tipo": "ponto_facultativo",
        "recorrente": False
    })
    
    # Segunda-feira de Carnaval: 48 dias antes
    carnaval_segunda = pascoa - timedelta(days=48)
    feriados.append({
        "data": carnaval_segunda.strftime("%Y-%m-%d"),
        "nome": "Segunda-feira de Carnaval",
        "tipo": "ponto_facultativo",
        "recorrente": False
    })
    
    # Terça-feira de Carnaval: 47 dias antes
    carnaval_terca = pascoa - timedelta(days=47)
    feriados.append({
        "data": carnaval_terca.strftime("%Y-%m-%d"),
        "nome": "Terça-feira de Carnaval",
        "tipo": "ponto_facultativo",
        "recorrente": False
    })
    
    # Quarta-feira de Cinzas: 46 dias antes (até 14h - ponto facultativo)
    cinzas = pascoa - timedelta(days=46)
    feriados.append({
        "data": cinzas.strftime("%Y-%m-%d"),
        "nome": "Quarta-feira de Cinzas (até 14h)",
        "tipo": "ponto_facultativo",
        "recorrente": False
    })
    
    # Sexta-feira Santa: 2 dias antes da Páscoa
    sexta_santa = pascoa - timedelta(days=2)
    feriados.append({
        "data": sexta_santa.strftime("%Y-%m-%d"),
        "nome": "Sexta-feira Santa",
        "tipo": "nacional",
        "recorrente": False
    })
    
    # Páscoa
    feriados.append({
        "data": pascoa.strftime("%Y-%m-%d"),
        "nome": "Páscoa",
        "tipo": "nacional",
        "recorrente": False
    })
    
    # Corpus Christi: 60 dias depois da Páscoa
    corpus_christi = pascoa + timedelta(days=60)
    feriados.append({
        "data": corpus_christi.strftime("%Y-%m-%d"),
        "nome": "Corpus Christi",
        "tipo": "ponto_facultativo",
        "recorrente": False
    })
    
    return feriados


def gerar_todos_feriados(ano: int) -> List[Dict[str, str]]:
    """
    Gera lista completa de feriados (fixos + móveis) para um ano, ordenada por data
    
    Args:
        ano: Ano desejado
    
    Returns:
        Lista ordenada de dicts com feriados
    """
    feriados = []
    
    # Adiciona fixos e móveis
    feriados.extend(calcular_feriados_fixos(ano))
    feriados.extend(calcular_feriados_moveis(ano))
    
    # Ordena por data
    feriados.sort(key=lambda x: x["data"])
    
    return feriados


def gerar_feriados_intervalo(ano_inicio: int, ano_fim: int) -> List[Dict[str, str]]:
    """
    Gera feriados para um intervalo de anos
    
    Args:
        ano_inicio: Ano inicial (inclusive)
        ano_fim: Ano final (inclusive)
    
    Returns:
        Lista com todos os feriados do intervalo
    """
    todos_feriados = []
    
    for ano in range(ano_inicio, ano_fim + 1):
        todos_feriados.extend(gerar_todos_feriados(ano))
    
    # Remove duplicatas (se houver) e ordena
    feriados_unicos = {}
    for f in todos_feriados:
        feriados_unicos[f["data"]] = f
    
    feriados_list = list(feriados_unicos.values())
    feriados_list.sort(key=lambda x: x["data"])
    
    return feriados_list


# Exemplo de uso
if __name__ == "__main__":
    # Gera feriados para 2026 (como no teste)
    feriados_2026 = gerar_todos_feriados(2026)
    
    print("Feriados de 2026:")
    print("-" * 60)
    for f in feriados_2026:
        print(f"{f['data']} | {f['nome']:<40} | {f['tipo']}")
    
    print(f"\nTotal: {len(feriados_2026)} feriados")
