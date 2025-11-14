import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30

def test_health_check_endpoint_returns_system_healthy():
    url = f"{BASE_URL}/api/health"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request to health check endpoint failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # The PRD indicates the health check returns a message indicating system health.
    # We'll assert that a key exists and the message indicates healthy status.
    # Since exact field name or message is not specified, we check common possibilities.

    # Check if 'message' key is present and indicates health
    message = data.get("message") or data.get("status") or ""
    assert isinstance(message, str), "Response 'message' or 'status' field is not a string"

    healthy_indicators = ["healthy", "ok", "up", "running"]
    assert any(indicator in message.lower() for indicator in healthy_indicators), \
        f"Health message does not indicate healthy system. Message: {message}"

test_health_check_endpoint_returns_system_healthy()