import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30

def test_get_all_portals_with_rfp_counts():
    url = f"{BASE_URL}/api/portals"
    headers = {
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(data, list), "Response JSON is not a list"

    for portal in data:
        assert isinstance(portal, dict), "Each portal entry should be a dictionary"
        # Portal should have an id or unique identifier
        assert "id" in portal or "portalId" in portal, "Portal entry missing 'id' or 'portalId'"
        # There should be RFP counts and statistics keys (checking common expected keys)
        assert any(key in portal for key in ["rfpCount", "rfpCounts", "statistics", "stats"]), "Portal entry missing RFP counts or statistics"
        # Optional deeper validation if keys exist
        if "rfpCount" in portal:
            assert isinstance(portal["rfpCount"], int), "'rfpCount' should be an integer"
        if "statistics" in portal:
            assert isinstance(portal["statistics"], dict), "'statistics' should be a dictionary"

test_get_all_portals_with_rfp_counts()