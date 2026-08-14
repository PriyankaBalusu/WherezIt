# Coding Agent — Security Reviewer

Review:
- Firebase tokens
- workspace authorization
- product-agent tool permissions
- QR/barcode resolution
- private images/signed access
- uploads
- rate limits
- secrets/IAM
- logs/privacy
- AI data handling

Reject:
- QR possession grants inventory access
- agents have unrestricted DB access
- cross-workspace leakage is possible
- sensitive tokens are logged
- private inventory storage is public


Also review:
- Cloud Tasks OIDC authentication and audience validation
- open-redirect resistance in post-login QR return flow
- Cloud Storage workspace/container object-key convention
