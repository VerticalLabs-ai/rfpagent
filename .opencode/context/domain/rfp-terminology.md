# RFP Domain Terminology

## Overview

Core terminology for government procurement and RFP (Request for Proposal) processes. Essential vocabulary for the RFP Agent platform's AI agents and workflows.

---

## Solicitation Types

### RFP (Request for Proposal)

Formal solicitation requesting detailed proposals with technical approach, pricing, and past performance. Evaluated on best value (not just price).

### RFQ (Request for Quote)

Price-focused solicitation for well-defined requirements. Typically awarded to lowest price technically acceptable (LPTA).

### RFI (Request for Information)

Market research tool to gather information before formal solicitation. Non-binding, no contract award.

### IFB (Invitation for Bid)

Sealed bid solicitation awarded to lowest responsive, responsible bidder. Used for clearly defined requirements.

### SOW (Statement of Work)

Detailed description of work to be performed, deliverables, and performance standards.

### PWS (Performance Work Statement)

Outcome-based work description focusing on results rather than methods. Common in performance-based contracts.

---

## Government Contracting Classifications

### NAICS Code (North American Industry Classification System)

6-digit code classifying business type. Used for small business size standards.

- Example: `541512` = Computer Systems Design Services
- Example: `541611` = Administrative Management Consulting

### PSC (Product Service Code)

4-character code identifying products/services being procured.

- Example: `D302` = IT Systems Development
- Example: `R425` = Engineering Technical Services

### Set-Aside Types

Contracts reserved for specific business categories:

- **SDVOSB**: Service-Disabled Veteran-Owned Small Business
- **8(a)**: SBA 8(a) Business Development Program
- **HUBZone**: Historically Underutilized Business Zone
- **WOSB/EDWOSB**: Women-Owned Small Business / Economically Disadvantaged
- **Small Business**: General small business set-aside

---

## Proposal Terminology

### Technical Volume

Proposal section describing approach, methodology, and technical solution. Addresses "how" the work will be performed.

### Cost/Price Volume

Pricing breakdown including labor rates, materials, ODCs (Other Direct Costs), and fee/profit.

### Past Performance Volume

Evidence of relevant experience, customer references, and performance history.

### Management Volume

Organizational structure, key personnel, quality assurance, and project management approach.

### Executive Summary

High-level overview capturing key themes, differentiators, and value proposition. First section evaluators read.

---

## Compliance Terminology

### FAR (Federal Acquisition Regulation)

Primary regulation governing federal procurement. All federal contracts must comply.

- FAR Part 15: Contracting by Negotiation
- FAR Part 52: Contract Clauses

### DFARS (Defense Federal Acquisition Regulation Supplement)

DoD-specific supplement to FAR with additional requirements.

- DFARS 252.204: Cybersecurity requirements
- DFARS 252.225: Buy American Act

### Compliance Matrix

Document mapping each RFP requirement to proposal response location. Proves all requirements addressed.

### Representations and Certifications

Mandatory attestations about business status, conflicts of interest, and regulatory compliance.

---

## RFP Status Terminology

| Status               | Description                    |
| -------------------- | ------------------------------ |
| **Pre-Solicitation** | Announced but not yet released |
| **Open/Active**      | Accepting proposals            |
| **Closed**           | Submission deadline passed     |
| **Under Evaluation** | Proposals being reviewed       |
| **Awarded**          | Contract awarded to winner     |
| **Cancelled**        | Solicitation withdrawn         |

---

## Mastra Agent Context

**Relevant Agents:**

- `compliance-checker`: Validates FAR/DFARS compliance
- `content-generator`: Creates proposal sections using this terminology
- `document-processor`: Extracts requirements from RFP documents

**Database Fields (shared/schema.ts):**

- `rfps.naicsCode`: 6-digit NAICS classification
- `rfps.pscCode`: Product/Service Code
- `rfps.setAsideType`: Set-aside category
- `rfps.contractType`: FFP, T&M, IDIQ, etc.
- `rfps.solicitationNumber`: Official solicitation ID

---

## Quick Reference

```yaml
# Common Contract Types
FFP: Firm Fixed Price (fixed cost, contractor bears risk)
T&M: Time and Materials (hourly rates + materials)
CPFF: Cost Plus Fixed Fee (reimbursable + fixed fee)
IDIQ: Indefinite Delivery/Indefinite Quantity (task orders)
BPA: Blanket Purchase Agreement (simplified ordering)

# Evaluation Methods
LPTA: Lowest Price Technically Acceptable
Best Value: Trade-off between price and technical merit
```
