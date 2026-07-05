"""JSONL run logs for synthetic user runs (#89).

Each event is one line of JSON, appended as it happens (so a killed run still
leaves a readable partial log). `RunLogger.summary()` produces the stdout
summary; Slack posting can reuse the existing #little-scout convention later.
"""

from __future__ import annotations

import json
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


@dataclass
class LogEvent:
    ts: str
    agent: str
    scenario: str
    action: str
    ok: bool
    detail: str = ""
    duration_ms: float | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_json_line(self) -> str:
        return json.dumps(asdict(self), sort_keys=True)


class RunLogger:
    """Appends LogEvents to a JSONL file, thread-safe for the team orchestrator."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._events: list[LogEvent] = []

    def log(self, event: LogEvent) -> None:
        with self._lock:
            self._events.append(event)
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(event.to_json_line() + "\n")

    @property
    def events(self) -> list[LogEvent]:
        return list(self._events)

    def summary(self) -> str:
        return format_summary(self._events, self.path)


def format_summary(events: list[LogEvent], path: Path | str) -> str:
    """Pure formatting, split out from RunLogger so it's trivially unit-testable."""
    total = len(events)
    ok = sum(1 for e in events if e.ok)
    failed = total - ok
    lines = [f"Synthetic run: {ok}/{total} actions ok, {failed} failed. Log: {path}"]
    for event in events:
        if not event.ok:
            lines.append(f"  FAIL {event.agent} {event.scenario}.{event.action}: {event.detail}")
    return "\n".join(lines)
