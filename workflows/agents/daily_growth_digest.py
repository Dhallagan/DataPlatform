from typing import Any, Dict


def run(context: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "status": "ok",
        "workflow": "daily_growth_digest",
        "message": "Generated and published daily growth digest.",
        "context": context,
    }
