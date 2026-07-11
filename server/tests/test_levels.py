from app.domain.economy.levels import level_for, naming_unlocked


def test_curve_and_cap() -> None:
    assert level_for(0) == 1
    assert level_for(399) == 1
    assert level_for(400) == 2
    assert level_for(800) == 3
    assert level_for(10_000_000) == 30  # capped


def test_naming_unlocks_at_three() -> None:
    assert not naming_unlocked(2)
    assert naming_unlocked(3)
