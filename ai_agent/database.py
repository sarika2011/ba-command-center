import os
import tempfile
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from ai_agent.config import PROJECT_ROOT

if os.environ.get("VERCEL"):
    db_path = Path(tempfile.gettempdir()) / "ba_command_center.db"
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path.resolve().as_posix()}"
else:
    db_path = Path(PROJECT_ROOT) / "ba_command_center.db"
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path.resolve().as_posix()}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

