import sys
from pathlib import Path

# Add project root directory to sys.path so ai_agent modules resolve properly in serverless runtime
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from ai_agent.main import app
