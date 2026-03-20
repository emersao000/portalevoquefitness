from datetime import datetime
import pytz

BRAZIL_TZ = pytz.timezone("America/Sao_Paulo")

def now_brazil_naive() -> datetime:
    dt = datetime.now(BRAZIL_TZ)
    return dt.replace(tzinfo=None)
