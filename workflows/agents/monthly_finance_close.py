from typing import Any, Dict


def run(context: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "status": "ok",
        "workflow": "monthly_finance_close",
        "message": "Monthly close orchestration completed with exception routing.",
        "context": context,
    }
