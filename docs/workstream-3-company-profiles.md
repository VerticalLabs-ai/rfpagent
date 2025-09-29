# Workstream 3 – Company Profiles Contract Notes

_Last updated: 2025-09-29_

## API Contracts

- **Company Profiles** (`GET /api/company/profiles`)
  - Returns `CompanyProfileSummary[]` from `shared/api/company.ts`.
  - Timestamps surface as ISO strings; UI consumers treat them as read-only metadata.
- **Company Contacts** (`GET /api/company/profiles/:id/contacts`)
  - Returns `CompanyContactRecord[]`; `decisionAreas` is normalised to `string[]` in the client helper to avoid `unknown`.
  - Mutations (`POST/PUT/DELETE`) now invalidate `['/api/company/profiles', profileId, 'contacts']` and the aggregate `['/api/company/profiles', 'all-contacts']` cache.
- **Expiring Assets**
  - Certifications: `GET /api/company/certifications/expiring` → `CompanyCertificationRecord[]`.
  - Insurance: `GET /api/company/insurance/expiring` → `CompanyInsuranceRecord[]`.

## Front-end Updates

- Removed `@ts-nocheck` from `company-profiles.tsx`; queries now use shared contracts and centralised analytics helpers.
- Added `client/src/utils/companyProfiles.ts` with utilities for contact normalisation, decision-maker filtering, and coverage calculations.
- Updated `ContactList` and `CompanyContactForm` to use the correct `/api/company/...` endpoints and shared query keys.

## Testing

- Added `tests/companyProfileAnalytics.test.ts` to cover decision-maker filtering, decision area coverage, and company coverage counts.

## Follow-ups

- Portal settings, proposals, scan history, and workflow management pages still require the shared contract refactor.
- Once server-side serializers exist, move the contact normalisation logic out of the client utility.
