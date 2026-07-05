from __future__ import annotations

from synthetic_users.personas import (
    PERSONAS,
    persona_for_index,
    random_ttf_body,
    random_value_for_metric,
)


def test_persona_for_index_round_robins_deterministically():
    n = len(PERSONAS)
    assert persona_for_index(0) is PERSONAS[0]
    assert persona_for_index(n) is PERSONAS[0]
    assert persona_for_index(n + 1) is PERSONAS[1]


def test_persona_for_index_is_deterministic_across_calls():
    assert persona_for_index(3) is persona_for_index(3)


def test_random_ttf_body_respects_persona_daypart_bias():
    persona = PERSONAS[0]
    for _ in range(20):
        body = random_ttf_body(persona)
        assert body["daypart"] in persona.daypart_bias


def test_random_ttf_body_party_size_matches_kids_count():
    persona = PERSONAS[1]  # big_family_weekend, 3 kids
    body = random_ttf_body(persona)
    assert body["party_size_kids"] == len(persona.kids_ages)


def test_random_ttf_body_omits_context_for_brief_style():
    brief_persona = next(p for p in PERSONAS if p.contribution_style == "brief")
    body = random_ttf_body(brief_persona)
    assert body["wait_context"] is None


def test_random_ttf_body_includes_context_for_thorough_style():
    thorough_persona = next(p for p in PERSONAS if p.contribution_style == "thorough")
    body = random_ttf_body(thorough_persona)
    assert body["wait_context"] == thorough_persona.note_style


def test_random_value_for_metric_boolean():
    value = random_value_for_metric({"metric_type": "boolean"})
    assert isinstance(value, bool)


def test_random_value_for_metric_enum():
    values = {random_value_for_metric({"metric_type": "enum", "enum_values": ["a", "b"]}) for _ in range(20)}
    assert values <= {"a", "b"}


def test_random_value_for_metric_numeric_respects_bounds():
    for _ in range(20):
        value = random_value_for_metric({"metric_type": "numeric", "min_value": 1, "max_value": 5})
        assert 1 <= value <= 5
