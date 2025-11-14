import requests
import uuid

BASE_URL = "http://localhost:5173"
HEADERS = {"Content-Type": "application/json"}
TIMEOUT = 30


def create_rfp():
    # Minimal valid RFP data for creation as per PRD
    rfp_data = {
        "rfpId": str(uuid.uuid4()),
        "title": "Test RFP " + str(uuid.uuid4())
    }
    response = requests.post(f"{BASE_URL}/api/rfps", json=rfp_data, headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    assert response.status_code == 201
    created = response.json()
    assert "id" in created
    return created["id"]


def delete_rfp(rfp_id):
    # No explicit delete endpoint mentioned in PRD for RFPs
    # So we cannot delete directly if not documented.
    # This function is a placeholder to comply with try-finally if needed.
    pass


def test_get_specific_rfp_by_id():
    rfp_id = None
    try:
        # Create a new RFP to test GET by ID
        rfp_id = create_rfp()

        # Test valid ID returns correct RFP details
        get_response = requests.get(f"{BASE_URL}/api/rfps/{rfp_id}", headers=HEADERS, timeout=TIMEOUT)
        assert get_response.status_code == 200
        rfp_details = get_response.json()
        assert isinstance(rfp_details, dict)
        assert rfp_details.get("id") == rfp_id

        # Test non-existent RFP ID returns 404
        non_existent_id = "nonexistent-" + str(uuid.uuid4())
        not_found_response = requests.get(f"{BASE_URL}/api/rfps/{non_existent_id}", headers=HEADERS, timeout=TIMEOUT)
        assert not_found_response.status_code == 404

    finally:
        if rfp_id:
            delete_rfp(rfp_id)


test_get_specific_rfp_by_id()
