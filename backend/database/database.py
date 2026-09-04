import os

import pyodbc
from dotenv import load_dotenv

load_dotenv()

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    f"SERVER={os.getenv('DB_SERVER', 'localhost')};"
    f"DATABASE={os.getenv('DB_NAME', 'python')};"
    "Trusted_Connection=yes;"
    "Encrypt=no;"
)


def get_connection():
    return pyodbc.connect(CONN_STR)


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
