from datetime import datetime, timezone

from app.db.repo import _coerce_enum, _coerce_ts


def test_ts_accepts_datetime_iso_z_and_none() -> None:
    dt = datetime(2026, 7, 12, 10, 22, tzinfo=timezone.utc)
    assert _coerce_ts(dt) is dt
    parsed = _coerce_ts("2026-07-12T10:22:04.288000Z")
    assert isinstance(parsed, datetime) and parsed.tzinfo is not None
    assert _coerce_ts(None) is None


def test_enum_accepts_enum_str_and_none() -> None:
    class Fake:
        value = "hesitation"
    assert _coerce_enum(Fake()) == "hesitation"
    assert _coerce_enum("cameld") == "cameld"
    assert _coerce_enum(None) is None
