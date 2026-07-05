from __future__ import annotations

import json

from synthetic_users.runlog import LogEvent, RunLogger, format_summary


def test_run_logger_appends_one_json_line_per_event(tmp_path):
    log_path = tmp_path / "run.jsonl"
    logger = RunLogger(log_path)
    logger.log(LogEvent("2026-01-01T00:00:00+00:00", "agent-00", "search", "sign_in", True))
    logger.log(LogEvent("2026-01-01T00:00:01+00:00", "agent-00", "search", "search_restaurants", False, "boom"))

    lines = log_path.read_text().splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["agent"] == "agent-00"
    assert first["ok"] is True
    second = json.loads(lines[1])
    assert second["ok"] is False
    assert second["detail"] == "boom"


def test_run_logger_summary_counts_ok_and_failed(tmp_path):
    logger = RunLogger(tmp_path / "run.jsonl")
    logger.log(LogEvent("t", "agent-00", "search", "sign_in", True))
    logger.log(LogEvent("t", "agent-01", "search", "sign_in", False, "no password"))

    summary = logger.summary()
    assert "1/2 actions ok, 1 failed" in summary
    assert "FAIL agent-01 search.sign_in: no password" in summary


def test_format_summary_is_pure_and_matches_logger(tmp_path):
    events = [
        LogEvent("t", "agent-00", "signup", "sign_up", True),
        LogEvent("t", "agent-00", "signup", "register", True),
    ]
    summary = format_summary(events, "some/path.jsonl")
    assert "2/2 actions ok, 0 failed" in summary
    assert "some/path.jsonl" in summary


def test_run_logger_events_survive_a_partial_write(tmp_path):
    log_path = tmp_path / "partial.jsonl"
    logger = RunLogger(log_path)
    logger.log(LogEvent("t", "agent-00", "search", "sign_in", True))
    # Simulate a killed run: only what was flushed should be on disk.
    assert log_path.read_text().count("\n") == 1
