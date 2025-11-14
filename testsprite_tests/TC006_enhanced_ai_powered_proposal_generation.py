import requests

BASE_URL = "http://localhost:5173"
TIMEOUT = 30


def test_enhanced_ai_powered_proposal_generation():
    # Step 1: Create a new RFP to use its ID
    rfp_payload = {
        "title": "Test RFP for Proposal Generation",
        "description": "RFP created for testing enhanced proposal generation.",
        "status": "open",
        "portalId": "test-portal-1"
    }
    headers = {"Content-Type": "application/json"}

    rfp_id = None
    company_profile_id = None

    try:
        rfp_response = requests.post(
            f"{BASE_URL}/api/rfps",
            json=rfp_payload,
            headers=headers,
            timeout=TIMEOUT
        )
        assert rfp_response.status_code == 201, f"Failed to create RFP: {rfp_response.text}"
        rfp_data = rfp_response.json()
        rfp_id = rfp_data.get("id")
        assert rfp_id, "Created RFP does not have an ID."

        # Step 2: Get or create a company profile to get companyProfileId
        company_profiles_response = requests.get(
            f"{BASE_URL}/api/company",
            timeout=TIMEOUT
        )
        assert company_profiles_response.status_code == 200, f"Failed to get company profiles: {company_profiles_response.text}"
        profiles = company_profiles_response.json()
        if profiles and isinstance(profiles, list) and len(profiles) > 0:
            company_profile_id = profiles[0].get("id")
        else:
            # create a company profile
            new_profile_payload = {
                "name": "Test Company Profile",
                "description": "Profile created for testing enhanced proposal generation."
            }
            create_profile_response = requests.post(
                f"{BASE_URL}/api/company",
                json=new_profile_payload,
                headers=headers,
                timeout=TIMEOUT
            )
            assert create_profile_response.status_code == 201, f"Failed to create company profile: {create_profile_response.text}"
            company_profile = create_profile_response.json()
            company_profile_id = company_profile.get("id")
            assert company_profile_id, "Created company profile does not have an ID."

        # Step 3: Call the enhanced AI-powered proposal generation endpoint
        proposal_payload = {
            "rfpId": rfp_id,
        }
        if company_profile_id:
            proposal_payload["companyProfileId"] = company_profile_id

        proposal_response = requests.post(
            f"{BASE_URL}/api/proposals/enhanced/generate",
            json=proposal_payload,
            headers=headers,
            timeout=TIMEOUT
        )
        assert proposal_response.status_code == 200, f"Proposal generation request failed: {proposal_response.text}"
        proposal_data = proposal_response.json()
        session_id = proposal_data.get("sessionId") or proposal_data.get("session_id")
        assert session_id and isinstance(session_id, str) and len(session_id) > 0, "No valid session ID returned."

    finally:
        # Cleanup: delete the created RFP
        if rfp_id:
            try:
                requests.delete(f"{BASE_URL}/api/rfps/{rfp_id}", timeout=TIMEOUT)
            except Exception:
                pass
        # Cleanup: delete the created company profile if created in this test
        # Only attempt delete if profile was created and not from existing list
        if company_profile_id and ("new_profile_payload" in locals()):
            try:
                requests.delete(f"{BASE_URL}/api/company/{company_profile_id}", timeout=TIMEOUT)
            except Exception:
                pass


test_enhanced_ai_powered_proposal_generation()
