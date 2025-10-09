# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in RFP Agent, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue
2. Email security@rfpagent.app with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Initial Response**: Within 24 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Critical issues within 30 days

### Disclosure Policy

- We will coordinate disclosure timing with you
- Security advisories will be published on GitHub
- Contributors will be credited (unless anonymity is preferred)

## Security Measures

### Application Security

#### Authentication & Authorization
- Session-based authentication with secure cookies
- Password hashing using bcrypt
- Role-based access control (RBAC)
- Multi-factor authentication support

#### Data Protection
- All data encrypted in transit (TLS 1.3)
- Sensitive data encrypted at rest
- Database connection encryption
- Secure environment variable management

#### API Security
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention via ORM
- XSS protection headers
- CORS policy enforcement
- Request size limits

### Infrastructure Security

#### Container Security
- Non-root user in containers
- Read-only root filesystem where possible
- Security context constraints
- Regular base image updates
- Vulnerability scanning (Trivy, Grype)

#### Kubernetes Security
- Network policies
- Pod security standards (restricted)
- Resource limits and quotas
- Secrets encryption at rest
- RBAC for service accounts
- Pod disruption budgets

#### Network Security
- TLS termination at ingress
- Internal service mesh encryption
- Private subnets for databases
- Network segmentation
- DDoS protection

### CI/CD Security

#### Pipeline Security
- Signed commits required
- Branch protection rules
- Automated security scanning
- Dependency vulnerability checks
- Container image scanning
- Secret detection

#### Supply Chain Security
- Dependency pinning
- Package lock files
- SBOM generation
- License compliance checks
- Verified base images

### Monitoring & Incident Response

#### Security Monitoring
- Real-time log analysis
- Intrusion detection
- Anomaly detection
- Failed authentication tracking
- Rate limit violations

#### Incident Response
- 24/7 on-call rotation
- Automated alerting
- Incident playbooks
- Regular security drills

## Security Best Practices

### For Developers

1. **Never commit secrets**
   - Use `.env` files (gitignored)
   - Use 1Password or similar for secrets
   - Use GitHub secrets for CI/CD

2. **Validate all inputs**
   - Use Zod schemas
   - Sanitize user input
   - Validate file uploads

3. **Follow secure coding practices**
   - Regular dependency updates
   - Use TypeScript for type safety
   - Follow OWASP Top 10 guidelines

4. **Review security scans**
   - Check Dependabot alerts
   - Review CodeQL findings
   - Address Semgrep warnings

### For Operators

1. **Secrets Management**
   - Rotate secrets regularly
   - Use Kubernetes secrets
   - Encrypt secrets at rest

2. **Access Control**
   - Principle of least privilege
   - Regular access reviews
   - Multi-factor authentication

3. **Monitoring**
   - Enable audit logging
   - Set up security alerts
   - Monitor for anomalies

4. **Updates**
   - Apply security patches promptly
   - Test updates in staging first
   - Have rollback procedures ready

## Security Checklist

### Pre-Deployment
- [ ] All secrets configured properly
- [ ] TLS certificates valid
- [ ] Security scanning passed
- [ ] Penetration testing completed
- [ ] Security review approved

### Post-Deployment
- [ ] Monitoring configured
- [ ] Alerts tested
- [ ] Backup procedures verified
- [ ] Incident response plan ready
- [ ] Access controls verified

## Compliance

### Standards
- OWASP Top 10 compliance
- CIS Kubernetes Benchmark
- SOC 2 Type II (in progress)
- GDPR compliance

### Data Handling
- Data minimization
- Purpose limitation
- Storage limitation
- Integrity and confidentiality
- Accountability

## Security Contacts

- **Security Team**: security@rfpagent.app
- **Bug Bounty**: https://rfpagent.app/security/bounty
- **PGP Key**: Available at https://rfpagent.app/.well-known/pgp-key.txt

## Acknowledgments

We thank the following security researchers for responsibly disclosing vulnerabilities:

(List will be updated as vulnerabilities are reported and fixed)

## Updates

This security policy is reviewed and updated quarterly. Last updated: 2025-10-02
