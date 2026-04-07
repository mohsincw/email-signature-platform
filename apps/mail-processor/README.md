# Chaiiwala Mail-Signature Relay

Server-side SMTP relay that intercepts outbound email from Chaiiwala's
Microsoft 365 tenant, embeds a pixel-perfect Myriad Pro signature as a
CID-attached inline image, and relays the modified message back to
Exchange Online for delivery.

Equivalent in spirit to CodeTwo Email Signatures 365's cloud mode,
running on a single DigitalOcean droplet against the shared Supabase
database used by the admin web UI.

## Architecture

```
Outlook / iPhone / Mac Mail
        │  (SMTP submission, any device)
        ▼
┌──────────────────────┐
│ Exchange Online      │
│ chaiiwala.co.uk      │
│                      │
│ Transport rule:      │
│  IF outbound AND     │
│     NOT X-ESP-       │
│     Processed header │
│  THEN route via      │
│       OUTBOUND       │
│       CONNECTOR →    │
└──────────┬───────────┘
           │ SMTP (STARTTLS)
           ▼
┌──────────────────────┐
│ This mail-processor  │
│ on DigitalOcean      │
│                      │
│ 1. Parse MIME        │
│ 2. Look up sender in │
│    Supabase          │
│ 3. Render Myriad Pro │
│    signature PNG     │
│ 4. Rebuild MIME with │
│    CID attachment    │
│ 5. Add X-ESP-        │
│    Processed header  │
└──────────┬───────────┘
           │ SMTP to
           │ chaiiwala-co-uk.mail.protection.outlook.com:25
           ▼
┌──────────────────────┐
│ Exchange Online      │
│ (same tenant)        │
│                      │
│ Inbound connector    │
│ trusts our IP →      │
│ treats as internal   │
│                      │
│ Transport rule sees  │
│ X-ESP-Processed and  │
│ SKIPS the outbound   │
│ connector this time  │
│                      │
│ Applies DKIM, sends  │
│ to recipient         │
└──────────┬───────────┘
           │
           ▼
     Recipient inbox
```

## Prerequisites

- A DigitalOcean droplet (or any Ubuntu 22.04+ VM) with:
  - A public IPv4 address
  - Ports 25, 80, 443, 587 open
  - Docker + docker-compose-v2 installed (`apt install docker.io docker-compose-v2`)
- A DNS A record pointing `mail-relay.chaiiwala.co.uk` at the droplet's IP
- Global Admin on the Chaiiwala Microsoft 365 tenant (to create connectors)
- The same `DATABASE_URL` used by the admin-web Vercel deployment

## Part 1 — First-time droplet setup

### 1. SSH into the droplet

Either via the DigitalOcean web console, or locally:

```bash
ssh root@167.172.49.118
```

### 2. Clone the repo

```bash
cd ~
git clone https://github.com/mohsincw/email-signature-platform.git
cd email-signature-platform/apps/mail-processor
```

### 3. Create the .env file

```bash
cp .env.example .env
nano .env
```

Fill in:
- `HOSTNAME` — `mail-relay.chaiiwala.co.uk` (or whatever subdomain you picked)
- `CERTBOT_EMAIL` — your email (used for Let's Encrypt expiry warnings)
- `DATABASE_URL` — the same Supabase pooled URL the Vercel admin uses
- `SMART_HOST_HOST` — Microsoft's MX for chaiiwala.co.uk
  (verify by running `dig mx chaiiwala.co.uk` from the droplet)

Save (`Ctrl+O`, Enter, `Ctrl+X` in nano).

### 4. Start the services

```bash
docker compose up -d
```

First run will:
- Build the mail-processor image (~3 min, one time)
- Run certbot to fetch a TLS cert for `mail-relay.chaiiwala.co.uk`
- Start the mail-processor listening on 25, 587, and 8080

### 5. Verify it started

```bash
docker compose logs -f mail-processor
```

Look for lines like:
```
Starting Chaiiwala mail signature relay
SMTP server listening on port 25
SMTP submission listener on port 587
Health endpoint listening { port: 8080 }
```

Press `Ctrl+C` to stop tailing. Check health:
```bash
curl -s http://localhost:8080/health
# {"status":"ok","uptime":42}
```

### 6. Schedule cert renewal

Let's Encrypt certs last 90 days. Run renewal every week via cron:

```bash
crontab -e
```

Add this line, save, exit:
```
0 4 * * 0 cd /root/email-signature-platform/apps/mail-processor && docker compose run --rm certbot && docker compose restart mail-processor
```

That runs every Sunday at 4am, attempts renewal, and restarts the
relay to pick up the new cert.

## Part 2 — Exchange Online connector setup

Done in https://admin.exchange.microsoft.com. You need to be Global
Admin or Exchange Admin.

### Step A — Inbound connector (trusts our droplet IP)

1. **Mail flow → Connectors → + Add a connector**
2. **From**: `Partner organization`
3. **To**: `Office 365`
4. **Name**: `Chaiiwala Signature Relay (inbound)`
5. **How to identify your partner**:
   - Choose **By verifying that the IP address of the sending server matches one of these IP addresses**
   - Add the droplet IP: `167.172.49.118`
6. **Security restrictions**:
   - ☑ Reject email if not sent over TLS
   - ☐ Reject email if sender domain doesn't match certificate (leave unchecked)
7. Click **Save**

### Step B — Outbound connector (routes mail to our droplet)

1. **Mail flow → Connectors → + Add a connector**
2. **From**: `Office 365`
3. **To**: `Partner organization`
4. **Name**: `Chaiiwala Signature Relay (outbound)`
5. **When to use**:
   - Choose **Only when email messages are sent to these domains**, add `*` (apply to all outbound)
   - OR **Only when I have a transport rule set up that redirects messages to this connector** — pick this (cleaner)
6. **How to route**:
   - Choose **Route email through these smart hosts**
   - Add `mail-relay.chaiiwala.co.uk`
7. **Security restrictions**:
   - ☑ Always use Transport Layer Security (TLS)
   - Choose **Any digital certificate, including self-signed certificates**
8. **Validate**:
   - Send a test to any external address (e.g. your personal Gmail)
   - If validation fails with "No connection could be made", double-check:
     - Firewall opens port 25 on the droplet
     - DNS `mail-relay.chaiiwala.co.uk` resolves to the droplet
     - `docker compose ps` shows mail-processor Up
9. Click **Save**

### Step C — Transport rule (routes outbound mail through us)

1. **Mail flow → Rules → + Add a rule → Create a new rule**
2. **Name**: `Chaiiwala Signature Relay`
3. **Apply this rule if**:
   - The sender is located → Inside the organization
4. **AND**:
   - The recipient is located → Outside the organization
   - *(Or leave this off if you want signatures on internal mail too)*
5. **Do the following**:
   - Redirect the message to → the following connector → `Chaiiwala Signature Relay (outbound)`
6. **Except if**:
   - A message header → includes any of these words
   - Header name: `X-ESP-Processed`
   - Header value: `v1`
7. **Rule mode**: Enforce
8. Save

### Step D — Disable the old transport rule (if present)

If you set up the hot-linked PNG transport rule earlier (via the
admin UI's Server-Side Mode button), **disable or delete it** so you
don't get two signatures on every email. In Mail flow → Rules, find
`ChaiiwalaEmailSignaturePlatform` and delete it.

## Part 3 — Test

1. From any Chaiiwala mailbox (e.g. mohsin@chaiiwala.co.uk), send a
   test email to a personal external address (Gmail, iCloud, etc.)
2. Watch the mail-processor logs on the droplet:
   ```bash
   docker compose logs -f mail-processor
   ```
3. You should see:
   ```
   Signature injected { senderEmail: 'mohsin@chaiiwala.co.uk', ... }
   Relaying processed message to smart host { ... }
   ```
4. Open the received email. The signature should be a pixel-perfect
   314×154 image with the Myriad Pro fonts, followed by the italic
   Arial 8pt disclaimer.

## Common commands

```bash
# See what's running
docker compose ps

# Tail logs
docker compose logs -f mail-processor

# Restart after changes
docker compose restart mail-processor

# Pull code updates + rebuild
cd ~/email-signature-platform && git pull && \
  cd apps/mail-processor && docker compose up -d --build

# Renew cert manually
docker compose run --rm certbot && docker compose restart mail-processor

# Stop everything
docker compose down
```

## Troubleshooting

**"Connection refused" when Exchange tries to connect**
- `docker compose ps` — is mail-processor listed as Up?
- `ss -tlnp | grep ':25'` — is something actually listening on port 25?
- `ufw status` — is port 25 allowed through the firewall?
- `telnet mail-relay.chaiiwala.co.uk 25` from another machine — does it connect?

**"TLS handshake failed"**
- `ls /var/lib/docker/volumes/mail-processor_letsencrypt/_data/live/` —
  is there a cert for mail-relay.chaiiwala.co.uk?
- Check certbot logs: `docker compose logs certbot`
- Re-run certbot: `docker compose run --rm certbot`

**"Signature not injected" in recipient email**
- Check mail-processor logs — was the sender email found in the DB?
  (`No matching sender in DB — relaying unchanged`)
- Verify the sender exists on the admin UI at
  https://your-vercel-url/senders, enabled, with the exact email
  that's being used as the From address

**"Signature appears TWICE" in recipient email**
- You probably still have the old Server-Side Mode hot-link transport
  rule active AND the new one. Go to Mail flow → Rules and delete the
  `ChaiiwalaEmailSignaturePlatform` rule (the hot-link one), keeping
  only the new `Chaiiwala Signature Relay` rule.

**Mail-processor crashes on startup with "Missing required env var"**
- Check `.env` exists in `apps/mail-processor/` on the droplet
- Check `DATABASE_URL` is set (the only required var)

**Outbound mail delayed by 5–10 minutes**
- Exchange retries delivery to our relay in a backoff if it's
  temporarily unreachable. Restart the relay and drain the queue:
  Admin center → Mail flow → Message trace → find the stuck messages.
