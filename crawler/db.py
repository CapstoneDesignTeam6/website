"""
crawler/db.py — 크롤러 전용 Supabase 클라이언트 (자체 완결형)

웹(backend_integrated)과 독립적으로 동작하도록, 환경변수만으로
Supabase 클라이언트를 만든다. 필요한 env: SUPABASE_URL, SUPABASE_KEY
"""
import os

from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
            options=ClientOptions(
                auto_refresh_token=False,
                persist_session=False,
                postgrest_client_timeout=10,
            ),
        )
    return _supabase_client
