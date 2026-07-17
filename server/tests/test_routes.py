"""Route-existence smoke test — no DB needed."""
from app.main import app


def test_all_expected_routes_registered() -> None:
    paths = set(app.openapi()["paths"].keys())
    expected = {
        "/api/v1/health",
        "/api/v1/auth/anon", "/api/v1/auth/signup", "/api/v1/auth/login", "/api/v1/auth/refresh",
        "/api/v1/sessions", "/api/v1/sessions/{session_id}/events", "/api/v1/sessions/{session_id}/end",
        "/api/v1/consents",
         "/api/v1/me", "/api/v1/me/export", "/api/v1/me/delete",
        "/api/v1/leaderboards/{band}",
        "/api/v1/photos",
        "/api/v1/missions", "/api/v1/missions/{mission_id}/accept",
    }
    missing = expected - paths
    assert not missing, f"routes missing: {missing}"