import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30

def test_get_documents_for_specific_rfp():
    headers = {
        "Content-Type": "application/json"
    }
    rfp_create_payload = {
        "title": "Test RFP for Document Retrieval",
        "description": "RFP created for testing the documents retrieval endpoint.",
        "status": "open",
        "portalId": "test-portal-001"
    }

    rfp_id = None
    try:
        # Create a new RFP to get a valid RFP id
        create_response = requests.post(
            f"{BASE_URL}/api/rfps",
            json=rfp_create_payload,
            headers=headers,
            timeout=TIMEOUT
        )
        assert create_response.status_code == 201, f"Failed to create RFP, status code: {create_response.status_code}"
        rfp_data = create_response.json()
        assert "id" in rfp_data, "Created RFP response missing 'id'"
        rfp_id = rfp_data["id"]

        # Get documents for the created RFP (likely empty list initially)
        get_docs_response = requests.get(
            f"{BASE_URL}/api/rfps/{rfp_id}/documents",
            headers=headers,
            timeout=TIMEOUT
        )
        assert get_docs_response.status_code == 200, f"Failed to get documents, status code: {get_docs_response.status_code}"
        docs_data = get_docs_response.json()
        assert isinstance(docs_data, list), "Documents response is not a list"

    finally:
        # Clean up: delete the created RFP if created
        if rfp_id:
            try:
                requests.delete(
                    f"{BASE_URL}/api/rfps/{rfp_id}",
                    headers=headers,
                    timeout=TIMEOUT
                )
            except Exception:
                pass

test_get_documents_for_specific_rfp()