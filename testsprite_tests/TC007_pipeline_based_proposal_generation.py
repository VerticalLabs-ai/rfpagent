import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30

def test_pipeline_based_proposal_generation():
    url = f"{BASE_URL}/api/proposals/pipeline/generate"
    headers = {
        "Content-Type": "application/json",
    }
    try:
        response = requests.post(url, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
        try:
            data = response.json()
            assert isinstance(data, dict), "Response JSON is not an object"
            # Accept any success message or indication, no defined schema given
            assert "success" in data.values() or "started" in data.values() or "status" in data, \
                "Response JSON does not indicate success or pipeline started"
        except ValueError:
            # If response is not JSON, accept empty or plain text 200 response as success
            assert response.text, "Response body is empty"
    except requests.Timeout:
        assert False, "Request timed out"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_pipeline_based_proposal_generation()
