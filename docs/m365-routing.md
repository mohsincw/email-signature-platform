# Microsoft 365 Mail Routing Integration

## Overview

Outbound mail from the tenant is redirected to the mail-processor over
SMTP, signed (if the sender exists and is enabled in the database),
and relayed back to Exchange Online for delivery. The round-trip is
loop-safe because every relayed message is stamped with an
`X-ESP-Processed: v1` header and the Exchange transport rule skips
messages that already carry it.

```
Outlook / OWA / mobile
   │
   ▼
Exchange Online ──(outbound connector + transport rule)──► mail-processor
   ▲                                                           │
   │                                                           │ rebuilds MIME,
   │                                                           │ stamps X-ESP-Processed
   │                                                           ▼
   └──(inbound connector, trusts droplet IP)──────────── back to tenant
                                                         (delivers to recipient)
```

## Full setup guide

All of the step-by-step configuration — droplet setup, inbound /
outbound connectors, transport rule, TNEF disabling, PowerShell
commands and troubleshooting — lives in the mail-processor's own
README because it has to stay next to the code that implements it:

**→ [`apps/mail-processor/README.md`](../apps/mail-processor/README.md)**

## Quick reference — required Exchange Online configuration

The mail-processor README has the full walkthrough. For a sanity
check / audit, these are the settings that have to be in place:

### Inbound connector (`Chaiiwala Signature Relay (inbound)`)

| Property | Required value |
|---|---|
| `ConnectorType` | `OnPremises` |
| `SenderIPAddresses` | The droplet's public IPv4 |
| `SenderDomains` | `smtp:*;1` |
| `RequireTls` | `True` |
| `CloudServicesMailEnabled` | `True` |
| `Enabled` | `True` |

The Admin UI can only create a `Partner`-type inbound connector which
is **not** enough for external relay — you must create this one via
`New-InboundConnector` in PowerShell (see the mail-processor README
Step A).

### Outbound connector (`Chaiiwala Signature Relay (outbound)`)

| Property | Required value |
|---|---|
| `ConnectorType` | `Partner` |
| `SmartHosts` | `mail-relay.chaiiwala.co.uk` (or your droplet's hostname) |
| `TlsSettings` | `EncryptionOnly` (Any digital certificate) |
| `UseMXRecord` | `False` |
| `IsTransportRuleScoped` | `True` |

### Transport rule (`Chaiiwala Signature Relay`)

| Property | Required value |
|---|---|
| `FromScope` | `InOrganization` |
| `SentToScope` | **unset** (`$null`) — do **not** scope to `NotInOrganization` or internal mail skips the relay |
| Action | Redirect to the outbound connector above |
| Exception | Header `X-ESP-Processed` contains `v1` |
| `State` | `Enabled` |

### Tenant-wide

| Setting | Required value | Why |
|---|---|---|
| SPF TXT on sender domain | Must include the droplet IPv4 alongside `include:spf.protection.outlook.com` | Required for `TenantAttribution` to succeed on relay back in |
| `Get-RemoteDomain Default` | `TNEFEnabled: False` | Stops Outlook's Rich-Text messages turning into `winmail.dat` attachments on the rebuilt MIME |

## Security posture

- The mail-processor listens on port 25 with STARTTLS enabled via
  Let's Encrypt certificates.
- Exchange → droplet trust is done by Exchange's TLS + the droplet's
  public cert matching its hostname.
- Droplet → Exchange trust is done by IP whitelisting on the inbound
  connector. No SMTP AUTH or service account is involved.
- The `X-ESP-Processed` loop-prevention header is stamped at the raw
  buffer level in `relay.ts` so every relayed message — including
  unchanged pass-throughs for disabled / unknown senders — cannot
  cause an Exchange-side loop.
