"""
Shared Supabase client — used by all CLI modules.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Load .env from project root (db.py -> lib/ -> cli/ -> korakuen/)
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)
