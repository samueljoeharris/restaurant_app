from fastapi import APIRouter

from ttf_api.db import get_conn
from ttf_api.schemas import MetricDefinition

router = APIRouter(prefix="/v1/metrics", tags=["metrics"])


@router.get("", response_model=list[MetricDefinition])
def list_metrics() -> list[MetricDefinition]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT key, label, metric_type, category, input_widget,
                   min_sample_size, enum_values, min_value, max_value
            FROM metric_definitions
            ORDER BY category, key
            """
        ).fetchall()
    return [
        MetricDefinition(
            key=row["key"],
            label=row["label"],
            metric_type=row["metric_type"],
            category=row["category"],
            input_widget=row["input_widget"],
            min_sample_size=row["min_sample_size"],
            enum_values=list(row["enum_values"]) if row["enum_values"] else None,
            min_value=row["min_value"],
            max_value=row["max_value"],
        )
        for row in rows
    ]
