import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30
HEADERS = {
    "Content-Type": "application/json",
}

def test_create_new_rfp():
    url = f"{BASE_URL}/api/rfps"
    # Adjusted minimal valid RFP data likely accepted by API
    rfp_payload = {
        "title": "Test RFP for Software Development",
        "portalId": "portal-12345",
        "status": "open"
    }

    response = None
    try:
        response = requests.post(url, json=rfp_payload, headers=HEADERS, timeout=TIMEOUT)
        # Assert that the response status code is 201 Created
        assert response.status_code == 201, f"Expected status code 201, got {response.status_code}"
        # Optionally validate that response JSON contains an id for the created RFP
        response_json = response.json()
        assert "id" in response_json and isinstance(response_json["id"], str) and response_json["id"], "Response JSON does not contain a valid 'id' for created RFP."
    finally:
        # Cleanup code omitted because DELETE endpoint is not defined in PRD
        pass

test_create_new_rfp()
