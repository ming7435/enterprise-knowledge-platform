from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def create_engine_from_url(database_url: str):
    kwargs = {}
    if database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if database_url.startswith("sqlite:///"):
            db_path = database_url.replace("sqlite:///", "", 1)
            if db_path != ":memory:":
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(database_url, future=True, **kwargs)


def create_session_factory(database_url: str):
    engine = create_engine_from_url(database_url)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True), engine
