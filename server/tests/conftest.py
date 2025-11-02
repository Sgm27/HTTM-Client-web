import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

for path in (ROOT, SRC):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
