import requests

BASE_URL = "http://localhost:5173"
DISCOVERY_ENDPOINT = "/api/discovery"
TIMEOUT = 30

def test_start_rfp_discovery_workflow():
    url = f"{BASE_URL}{DISCOVERY_ENDPOINT}"
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, headers=headers, timeout=TIMEOUT)
        # Assert that the status code is 201 Created
        assert response.status_code == 201, f"Expected status code 201 but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request to start RFP discovery workflow failed: {e}"

test_start_rfp_discovery_workflow()