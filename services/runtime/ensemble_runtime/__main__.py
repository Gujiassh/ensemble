"""CLI: python -m ensemble_runtime"""

from __future__ import annotations


def main() -> None:
    import os

    import uvicorn

    port = int(os.environ.get("ENSEMBLE_RUNTIME_PORT", "18427"))
    uvicorn.run(
        "ensemble_runtime.api.app:app",
        host="127.0.0.1",
        port=port,
        reload=False,
    )


if __name__ == "__main__":
    main()
