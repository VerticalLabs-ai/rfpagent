import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30

def test_get_all_rfps_with_pagination_and_filtering():
    # Define filter query parameters
    params = {
        "status": "active",
        "portalId": "portal-123"
        # Omitting page and limit to check default pagination values
    }
    try:
        response = requests.get(f"{BASE_URL}/api/rfps", params=params, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # Validate response
    assert response.status_code == 200, f"Unexpected status code: {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Check that data is a list (paginated response as list)
    assert isinstance(data, list), "Response JSON is not a list"

    # Check default pagination: since not specified, defaults are page=1 and limit=20
    # Assert that at most 20 items returned (limit=20)
    assert len(data) <= 20, f"More than default limit RFPs returned: {len(data)}"

    # Check that all returned RFPs match the status and portalId filter
    for rfp in data:
        assert isinstance(rfp, dict), "RFP entry is not a dictionary"
        # Check status filter
        assert "status" in rfp, "RFP entry missing 'status' field"
        assert rfp["status"] == params["status"], f"RFP status mismatch: expected {params['status']}, got {rfp['status']}"
        # Check portalId filter
        assert "portalId" in rfp, "RFP entry missing 'portalId' field"
        assert rfp["portalId"] == params["portalId"], f"RFP portalId mismatch: expected {params['portalId']}, got {rfp['portalId']}"

test_get_all_rfps_with_pagination_and_filtering()