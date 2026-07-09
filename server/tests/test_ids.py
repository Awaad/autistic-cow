from uuid import UUID

from app.core.ids import new_id, new_token


def test_uuidv7_version_and_ordering() -> None:
    ids = [new_id() for _ in range(500)]
    assert all(isinstance(i, UUID) and i.version == 7 for i in ids)
    # v7 = time-ordered: generated sequence must be sorted (ADR-001 rationale)
    assert ids == sorted(ids)


def test_tokens_are_not_uuids() -> None:
    t = new_token()
    assert len(t) >= 20
