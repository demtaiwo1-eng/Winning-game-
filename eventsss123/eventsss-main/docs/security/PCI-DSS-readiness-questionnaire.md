# EPHINTA PCI DSS Readiness Questionnaire (Operator/Admin Use)

**Purpose:** scope and readiness discovery only. Completing this document does not certify compliance. Engage a qualified PCI professional/QSA where applicable and confirm requirements with the acquiring bank/payment provider.

**Never collect or store** full card verification codes (CVV/CVC), PIN/PIN block, full magnetic-stripe/track data, or authentication secrets after authorization. Do not place raw PAN, CVV, PIN, OTP, bank passwords, API secrets, or production credentials in this document, tickets, chat, source control, or logs. Use the payment provider's hosted checkout/hosted fields and tokenization where possible.

## A. Payment and data-flow scope
- [ ] Which legal entity operates EPHINTA, and who is the merchant of record?
- [ ] Which payment providers/acquirers are used, and which countries/currencies are in scope?
- [ ] Does EPHINTA ever receive, process, transmit, or store cardholder data, or does the provider handle all card entry?
- [ ] Are hosted checkout/hosted fields and provider tokens used instead of handling raw card data?
- [ ] Is there a current card-data-flow diagram, system inventory, and network/data-flow map?
- [ ] Which systems, cloud accounts, APIs, staff, vendors and environments could affect payment security?
- [ ] Has the acquiring bank/provider identified the applicable SAQ/ROC and validation method in writing?

## B. Payment provider and application integration
- [ ] Provider name, account owner, production/test environment separation and support contact are documented (no secret keys here).
- [ ] Server verifies webhook signatures using secrets held only in the secrets manager.
- [ ] Webhooks are idempotent; replay/duplicate events cannot duplicate credits, deposits or withdrawals.
- [ ] Payment success is verified server-to-server; client redirects are not trusted as proof.
- [ ] Amount, currency, merchant/account, reference and transaction state are validated server-side.
- [ ] Provider tokens are used; PAN/CVV are not logged, stored or sent through EPHINTA APIs.
- [ ] Refunds, chargebacks, reversals, reconciliation and failed-payment states are tested.
- [ ] Secrets are rotated and separated by development, staging and production environment.

## C. Access control and identity
- [ ] Unique named accounts are used for staff/admin access; shared accounts are prohibited.
- [ ] MFA is enabled for administrators, cloud consoles, payment provider accounts and source control.
- [ ] Least-privilege role permissions and periodic access reviews are implemented.
- [ ] Joiner/mover/leaver process promptly removes access.
- [ ] Authentication rate limits, secure password storage, session expiry and recovery flows are tested.
- [ ] Privileged actions, payout destination changes and withdrawals require appropriate authorization/step-up checks.

## D. Secure development and application security
- [ ] Security requirements are part of design/review and release approval.
- [ ] Code review and protected branch rules are enabled for payment/auth changes.
- [ ] Dependencies, containers, infrastructure and secrets are scanned for known vulnerabilities.
- [ ] Input validation, output encoding, CSRF protections where relevant, secure headers and CORS are reviewed.
- [ ] API authorization is checked for every account-owned resource; user IDs from the client are never trusted alone.
- [ ] SAST/DAST/dependency scanning and remediation SLAs are documented.
- [ ] Independent penetration testing is performed at the required scope/frequency and findings are remediated.
- [ ] Production data is not copied into development/test without approved protection and minimization.

## E. Network, infrastructure and cloud
- [ ] Network segmentation isolates the cardholder data environment where applicable.
- [ ] Firewall/security-group rules are documented, least-privilege and periodically reviewed.
- [ ] Default vendor credentials and unnecessary services/accounts are removed.
- [ ] Systems are hardened, patched and supported; configuration baselines are monitored.
- [ ] Administrative access is encrypted and restricted; remote access is MFA-protected.
- [ ] Cloud responsibility matrix, storage permissions, backups and encryption settings are reviewed.
- [ ] Production secrets are held in a managed secret store and never committed to Git or shipped to the browser.

## F. Encryption and sensitive data
- [ ] Data classification and retention/deletion policy are documented.
- [ ] Strong approved encryption is used for transmission over public networks.
- [ ] Stored cardholder data is avoided unless there is a documented, approved need and compliant protection.
- [ ] Cryptographic keys have ownership, access controls, rotation, storage and revocation procedures.
- [ ] Logs, analytics, error reporting and support tickets are checked for card data and secrets.
- [ ] CVV/CVC, PIN/PIN block and full track data are never retained after authorization.

## G. Logging, monitoring and incident response
- [ ] Audit logs capture relevant access and security events, are protected against alteration, and have synchronized time.
- [ ] Alerts cover suspicious login, admin changes, webhook failures, unusual payouts and repeated authorization failures.
- [ ] Logs do not expose passwords, session tokens, secret keys or sensitive card data.
- [ ] Incident response plan identifies owners, payment provider/acquirer contacts and notification obligations.
- [ ] Incident response and breach scenarios are rehearsed and evidence is retained safely.

## H. Vulnerability management and testing
- [ ] Internal/external vulnerability scans are performed at the applicable required cadence.
- [ ] External ASV scans are completed where applicable, with passing evidence retained.
- [ ] Penetration tests and segmentation tests are performed where required.
- [ ] Findings are prioritized, assigned, remediated and retested.
- [ ] Release acceptance tests cover payment success/failure, duplicates, replay, reversals, reconciliation and authorization boundaries.

## I. Policies, people and third parties
- [ ] Information security policy is approved, communicated and reviewed at least annually.
- [ ] Staff security awareness and role-specific payment-data training are current.
- [ ] Third-party service providers' PCI status, responsibilities and contracts are documented.
- [ ] Responsibility matrix shows which controls are provider-managed versus EPHINTA-managed.
- [ ] Data retention, disposal, access review, incident response and change management policies are maintained.

## J. Evidence and accountable owners
For each control, record **owner, status, evidence location, last reviewed date, gap, remediation due date** in an access-controlled system. Do not paste secrets or cardholder data as evidence.

- Compliance owner:
- Technical security owner:
- Payment provider/acquirer contact:
- Target assessment date:
- Confirmed SAQ/ROC type from acquirer/provider:
- Open critical/high-risk gaps:
- Remediation plan and due dates:

## Go-live gate
- [ ] Payment provider confirms integration and validation requirements.
- [ ] Applicable PCI validation method is confirmed with acquirer/provider.
- [ ] No unresolved critical/high-severity payment security findings.
- [ ] Deposit, withdrawal, refund, reconciliation and webhook idempotency tests pass in staging.
- [ ] No real payment credentials or card data are present in repository, logs or test fixtures.
- [ ] Compliance/security owner approves release and retains evidence.
