"""Configuration loader — reads .env and exposes settings."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (one level up from ai_agent/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
LLM_MODEL: str = os.getenv("LLM_MODEL", "claude-sonnet-4-6")
LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))

def _is_api_key_valid(key: str) -> bool:
    if not key or not key.strip():
        return False
    k = key.strip().lower()
    if k in ("mock_mode", "mock", "your-real-key-here", "none", "null", "false"):
        return False
    if k.startswith("your_") or k.startswith("your-") or len(k) < 15:
        return False
    return True

# ── Mock Mode Toggle ─────────────────────────────────────────────────
# Automatically activate Mock Mode if ANTHROPIC_API_KEY is missing/placeholder.
# Real Claude is activated when a genuine key (e.g. sk-ant-...) is provided.
_env_mock = os.getenv("MOCK_MODE", "").lower()
if _env_mock in ("true", "1", "yes"):
    MOCK_MODE: bool = True
elif _env_mock in ("false", "0", "no"):
    MOCK_MODE: bool = not _is_api_key_valid(ANTHROPIC_API_KEY)
else:
    MOCK_MODE: bool = not _is_api_key_valid(ANTHROPIC_API_KEY)

# ── Auth Settings ────────────────────────────────────────────────────
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

import tempfile

# Output folders (relative to project root or tempdir for serverless)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

if os.environ.get("VERCEL"):
    tmp_base = Path(tempfile.gettempdir())
    OUTPUT_DIRS = {
        "requirements": tmp_base / "Requirements",
        "meeting-prep": tmp_base / "Meetings",
        "jira": tmp_base / "Jira_Tickets",
        "gap-analysis": tmp_base / "Gap_Analysis",
        "action-items": tmp_base / "Action_Items",
        "test-cases": tmp_base / "Test_Cases",
        "minutes": tmp_base / "Meeting_Minutes",
        "process-model": tmp_base / "Process_Models",
        "business-case": tmp_base / "Business_Cases",
        "risk-log": tmp_base / "Risk_Logs",
        "glossary": tmp_base / "Domain_Glossaries",
    }
else:
    OUTPUT_DIRS = {
        "requirements": PROJECT_ROOT / "Requirements",
        "meeting-prep": PROJECT_ROOT / "Meetings",
        "jira": PROJECT_ROOT / "Jira_Tickets",
        "gap-analysis": PROJECT_ROOT / "Gap_Analysis",
        "action-items": PROJECT_ROOT / "Action_Items",
        "test-cases": PROJECT_ROOT / "Test_Cases",
        "minutes": PROJECT_ROOT / "Meeting_Minutes",
        "process-model": PROJECT_ROOT / "Process_Models",
        "business-case": PROJECT_ROOT / "Business_Cases",
        "risk-log": PROJECT_ROOT / "Risk_Logs",
        "glossary": PROJECT_ROOT / "Domain_Glossaries",
    }

# Ensure output dirs exist
for d in OUTPUT_DIRS.values():
    try:
        d.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass

