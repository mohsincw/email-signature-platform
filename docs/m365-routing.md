# Microsoft 365 Mail Routing Integration

## Overview

This document outlines the steps to route outbound Microsoft 365 email through the mail processor service for automatic signature injection.

## Architecture

```
Sender (Outlook) → M365 Exchange Online → Mail Flow Rule → Mail Processor (SMTP :2525) → SMTP Relay → Internet
```

## TODO: Setup Steps

### 1. Exchange Online Mail Flow Rule

Create a transport rule in Exchange Admin Center that redirects outbound mail to the mail processor:

- **Condition**: Sender is inside the organisation
- **Action**: Redirect the message to the mail processor host
- **Exceptions**: Messages with header `X-Org-Signature-Applied` equals `true`

### 2. Outbound Connector

Configure an outbound connector in Exchange Online:

- **Type**: Partner organisation
- **Smart host**: Your mail processor's public hostname/IP
- **Port**: 2525 (or configured port)
- **TLS**: Required (configure certificates)

### 3. Mail Processor Relay Config

Configure the mail processor to relay processed messages back through Microsoft 365 or directly to the internet:

- Set `SMTP_RELAY_HOST` to your M365 MX endpoint or a dedicated relay
- Set `SMTP_RELAY_PORT` to the appropriate port

### 4. DNS / Network

- Ensure the mail processor is reachable from Exchange Online
- Configure SPF/DKIM/DMARC to include the mail processor's IP
- Open firewall for inbound SMTP on the processor port

### 5. TLS Certificates

- Install valid TLS certificates on the mail processor
- Enable STARTTLS in the SMTP server configuration
- Remove `disabledCommands: ["STARTTLS"]` from smtp-server config

## Security Considerations

- The mail processor should only accept connections from known Microsoft 365 IP ranges
- Use TLS for all SMTP connections
- The `X-Org-Signature-Applied` header prevents double-signing
- Consider rate limiting and connection throttling
