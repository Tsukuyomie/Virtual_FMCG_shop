import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use the 'DATABASE_URL' environment variable from Render settings
DATABASE_URL = os.getenv("DATABASE_URL")

# Fix for Render/Heroku which sometimes uses 'postgres://' instead of 'postgresql://'
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
