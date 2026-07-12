from datetime import datetime, timedelta, timezone

from app.domain.economy.energy import energy_now

NOW = datetime(2026, 7, 12, 12, 0, tzinfo=timezone.utc)


def test_regen_fills_one_per_period_and_caps() -> None:
    e, nxt = energy_now(1, NOW - timedelta(hours=7), NOW)  # 2 periods @3h
    assert e == 3
    assert 0 < nxt <= 3 * 3600
    e, nxt = energy_now(4, NOW - timedelta(days=2), NOW)
    assert (e, nxt) == (5, 0)  # capped, no countdown


def test_no_time_no_gain() -> None:
    assert energy_now(2, NOW, NOW)[0] == 2
