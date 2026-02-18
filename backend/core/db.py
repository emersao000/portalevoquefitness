from __future__ import annotations
import os
from typing import Generator, Dict, Any
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from dotenv import load_dotenv
import pathlib

# Load .env first
load_dotenv()

# Try to import env.py as module; if not valid python, fall back to parsing it as dotenv
try:
    import env as _env  # type: ignore
except Exception:
    _env = None
    # Try to load key=value from backend/env.py as dotenv-format
    try:
        base_dir = pathlib.Path(__file__).resolve().parent.parent  # backend/
        alt_env = base_dir / "env.py"
        if alt_env.exists():
            load_dotenv(alt_env.as_posix())
    except Exception:
        pass

DB_HOST = (_env.DB_HOST if _env and getattr(_env, "DB_HOST", None) else os.getenv("DB_HOST", "localhost"))
DB_USER = (_env.DB_USER if _env and getattr(_env, "DB_USER", None) else os.getenv("DB_USER", "root"))
DB_PASSWORD = (_env.DB_PASSWORD if _env and getattr(_env, "DB_PASSWORD", None) else os.getenv("DB_PASSWORD", ""))
DB_NAME = (_env.DB_NAME if _env and getattr(_env, "DB_NAME", None) else os.getenv("DB_NAME", "test"))
DB_PORT = int((_env.DB_PORT if _env and getattr(_env, "DB_PORT", None) else os.getenv("DB_PORT", "3306")))
DB_SSL_CA = (_env.DB_SSL_CA if _env and getattr(_env, "DB_SSL_CA", None) else os.getenv("DB_SSL_CA"))

url = URL.create(
    drivername="mysql+pymysql",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=int(DB_PORT),
    database=DB_NAME,
    query={"charset": "utf8mb4"},
)

connect_args: Dict[str, Any] = {}
if DB_SSL_CA:
    connect_args["ssl"] = {"ca": DB_SSL_CA}

engine = create_engine(
    url,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=40,
    pool_recycle=3600,
    pool_timeout=30,
    connect_args=connect_args,  # type: ignore[arg-type]
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
