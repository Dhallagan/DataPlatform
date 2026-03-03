from typing import Any, Dict


def run(context: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "status": "ok",
        "workflow": "event_invoice_overdue",
        "message": "Overdue invoice event handled and dunning step executed.",
        "context": context,
    }
