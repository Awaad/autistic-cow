from app.domain.judge.axis import band_for, compute_axis


def test_full_psycho_run_lands_in_menace_territory() -> None:
    events = ["child_scared", "rescue_ignored", "destruction_spree"] * 10
    axis = compute_axis(events, events)
    assert axis < -0.2
    assert band_for(axis) in ("menace", "enthusiast")


def test_saint_run_lands_positive() -> None:
    events = ["rescue_completed", "child_helped", "mission_completed"] * 10
    axis = compute_axis(events, events)
    assert axis > 0.2


def test_axis_always_clamped() -> None:
    events = ["child_helped"] * 10_000
    assert -1.0 <= compute_axis(events, events) <= 1.0
