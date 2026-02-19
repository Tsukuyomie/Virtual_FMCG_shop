from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DB_USER = "postgres" # Update this
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "inventory_forecasting" # Update this

DATABASE_URL = f"postgresql://{DB_USER}:{123456789}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)