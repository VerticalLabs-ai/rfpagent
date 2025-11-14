import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30

def test_get_detailed_rfps_with_compliance_data():
    url = f"{BASE_URL}/api/rfps/detailed"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate that the data is a list (assuming multiple detailed RFPs can be returned)
    assert isinstance(data, list), "Response JSON is not a list as expected"

    # Validate that each item is a dictionary
    for item in data:
        assert isinstance(item, dict), "Each item should be a dictionary"


test_get_detailed_rfps_with_compliance_data()
