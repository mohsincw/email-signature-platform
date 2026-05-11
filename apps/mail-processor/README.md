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
│ 3a. If sender found  │
│     + enabled:       │
│     render PNG,      │
│     rebuild MIME     │
│     with CID img     │
│ 3b. If not found /   │
│     disabled:        │
│     rebuild MIME     │
│     unchanged (no    │
│     signature) so    │
│     the message      │
│     still flows      │
│ 4. Always stamp      │
│    X-ESP-Processed   │
│    header before     │
│    relaying          │
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

The Exchange Admin Center UI can only create a **Partner**-type
inbound connector, which is NOT enough to allow relay to external
recipients (mail to internal chaiiwala.co.uk addresses will work but
mail to Gmail / Hotmail / etc. will be rejected with
`5.7.64 TenantAttribution; Relay Access Denied`).

You must create it via PowerShell as an **OnPremises** connector with
`CloudServicesMailEnabled` set to `$true`.

1. On any Windows machine, open PowerShell and connect to Exchange
   Online:

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser
   Import-Module ExchangeOnlineManagement
   Connect-ExchangeOnline -UserPrincipalName your-admin@chaiiwala.co.uk
   ```

2. Create the inbound connector:

   ```powershell
   New-InboundConnector `
     -Name "Chaiiwala Signature Relay (inbound)" `
     -ConnectorType OnPremises `
     -SenderDomains "smtp:*;1" `
     -SenderIPAddresses 167.172.49.118 `
     -RequireTls $true `
     -CloudServicesMailEnabled $true `
     -Enabled $true
   ```

3. Verify:

   ```powershell
   Get-InboundConnector "Chaiiwala Signature Relay (inbound)" | fl Name,ConnectorType,SenderIPAddresses,SenderDomains,Enabled,RequireTls,CloudServicesMailEnabled
   ```

   You should see `ConnectorType: OnPremises`, `RequireTls: True`,
   `CloudServicesMailEnabled: True`.

> **Why `CloudServicesMailEnabled` matters:** despite the misleading
> name, this flag tells Exchange Online to treat the internal
> `X-MS-Exchange-Organization-*` headers as authoritative and to
> attribute the inbound message to your tenant — which is what lets
> Exchange relay the message to external recipients rather than
> treating it as plain direct-send (internal only).

> **Also required:** your SPF record for `chaiiwala.co.uk` MUST list
> the droplet IP, e.g.
> `v=spf1 ip4:167.172.49.118 include:spf.protection.outlook.com -all`.
> Verify with `dig txt chaiiwala.co.uk +short`. Without this, external
> delivery will also fail for tenant-attribution reasons.

### Step B — Outbound connector (routes mail to our droplet)

1. **Mail flow → Connectors → + Add a connector**
2. **From**: `Office 365`
3. **To**: `Partner organization`
4. **Name**: `Chaiiwala Signature Relay (outbound)`
5. **When to use**:
   - Choose **Only when I have a transport rule set up that redirects messages to this connector** (cleaner than domain matching — the transport rule in Step C handles the scoping)
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
4. **Do the following**:
   - Redirect the message to → the following connector → `Chaiiwala Signature Relay (outbound)`
5. **Except if**:
   - A message header → includes any of these words
   - Header name: `X-ESP-Processed`
   - Header value: `v1`
6. **Rule mode**: Enforce
7. Save

> **Do NOT scope the rule to "recipient is outside the organization".**
> Internal mail (chaiiwala → chaiiwala) should also be processed so the
> signature is applied consistently regardless of destination. If the
> rule ends up with `SentToScope = NotInOrganization`, internal mail
> silently bypasses the droplet with no signature. Fix by clearing it:
>
> ```powershell
> Set-TransportRule "Chaiiwala Signature Relay" -SentToScope $null
> ```

### Step D — Disable TNEF on outbound mail

Classic Outlook can send messages in Microsoft's proprietary
Rich-Text / TNEF format. When Exchange Online hands a TNEF message
to our droplet via the outbound connector, `mailparser` can't decode
the binary TNEF body and the rebuilt MIME ends up with a
`winmail.dat` attachment and no rich content. Fix by telling
Exchange to convert everything to standard MIME (HTML / plain text)
before sending it through any connector:

```powershell
Set-RemoteDomain Default -TNEFEnabled $false
```

Verify:

```powershell
Get-RemoteDomain Default | fl Name,TNEFEnabled
```

You want `TNEFEnabled : False`. This is the Microsoft-recommended
default for any org that's not doing pure Exchange-to-Exchange RTF
interop and will not affect HTML formatting — only the legacy
Word-RTF-via-TNEF wrapper.

### Step E — Disable the old transport rule (if present)

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

## Monitoring & alerting

The relay has a single point of failure (one droplet, one outgoing
IP) so we run an external uptime monitor as a dead-man's-switch:
the droplet pings the monitor every 5 min when everything is healthy
and the monitor alerts when pings stop arriving.

### What gets checked

`scripts/smtp-health-probe.sh` runs every 5 min via cron and verifies:

1. **mail-processor health endpoint** responds on `localhost:8080`
   — catches container crash / app-level hang
2. **SMTP listener** accepts a TCP connection on port 25
   — catches port conflicts / firewall regressions
3. **End-to-end deliverability** via `swaks --quit-after RCPT`
   to the smart host — catches IP bans (`5.7.606`), DNS regressions,
   smart host outages, expired certs

Only when all three pass does the script ping the heartbeat URL.

### One-time setup

#### 1. Install swaks on the droplet

```bash
apt install -y swaks
```

#### 2. Create a heartbeat monitor

Pick one (both free for this use case):

**UptimeRobot** (https://uptimerobot.com):
- New monitor → **Heartbeat**
- Friendly name: `Chaiiwala mail relay`
- Heartbeat interval: **10 minutes** (give the 5-min cron a 2x grace
  window so a single late run doesn't false-alarm)
- Alert contact: `mohsin@chaiiwala.co.uk`
- Save and copy the heartbeat URL (looks like
  `https://heartbeat.uptimerobot.com/m000000000-aaaaaaaaaa`)

**Better Stack** (https://betterstack.com):
- Uptime → New monitor → **Cron job / heartbeat**
- Expected interval: **5 minutes**, grace: **5 minutes**
- Alert contact: `mohsin@chaiiwala.co.uk`
- Save and copy the URL

#### 3. Add the URL to `.env`

```bash
nano /root/email-signature-platform/apps/mail-processor/.env
```

Add (or uncomment) at the bottom:

```
HEARTBEAT_URL=https://heartbeat.uptimerobot.com/m000000000-aaaaaaaaaa
```

Save (`Ctrl+O`, Enter, `Ctrl+X`).

#### 4. Wire up cron

```bash
crontab -e
```

Add this line (alongside the existing cert-renewal entry):

```
*/5 * * * * /root/email-signature-platform/apps/mail-processor/scripts/smtp-health-probe.sh
```

Save, exit. The probe will run every 5 min from now on.

#### 5. Verify it's working

Trigger a probe manually:

```bash
/root/email-signature-platform/apps/mail-processor/scripts/smtp-health-probe.sh
tail -20 /var/log/mail-monitor.log
```

You should see `OK: probe succeeded, heartbeat sent`. Check the
monitor dashboard — it should now show as "up" and the last-seen
timestamp should match.

### Verifying alerts work end-to-end

The easiest way to confirm alerts actually arrive: temporarily break
the probe by setting an invalid `HEARTBEAT_URL` (e.g. append `-BROKEN`
to the real one) and wait ~15 min. UptimeRobot / Better Stack should
email `mohsin@chaiiwala.co.uk`. Restore the correct URL once verified.

### What an alert looks like in practice

When a real issue hits (IP ban, container crash, smart host
unreachable):

1. Cron runs at minute :00, :05, :10... → probe fails → no heartbeat ping
2. After ~10 min of missed pings, the monitor sends an email to
   `mohsin@chaiiwala.co.uk`
3. You SSH in and check `tail -50 /var/log/mail-monitor.log` to see
   which check failed (health endpoint / port 25 / smart host)
4. Fix the underlying issue; next successful probe re-arms the monitor

This trades ~10 min detection latency for full coverage with zero
infrastructure on our side beyond the cron job.

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

**External delivery fails with `5.7.64 TenantAttribution; Relay Access Denied`**
- Internal mail (chaiiwala → chaiiwala) works but Gmail / Hotmail
  bounces. The inbound connector isn't fully trusted for relay.
- Check it was created with `ConnectorType: OnPremises` AND
  `CloudServicesMailEnabled: True`:
  ```powershell
  Get-InboundConnector "Chaiiwala Signature Relay (inbound)" | fl ConnectorType,CloudServicesMailEnabled,RequireTls
  ```
- If either is missing, fix in place:
  ```powershell
  Set-InboundConnector "Chaiiwala Signature Relay (inbound)" `
    -CloudServicesMailEnabled $true -RequireTls $true
  ```
- Also verify SPF contains the droplet IP:
  `dig txt chaiiwala.co.uk +short` should include the droplet's IPv4
  alongside `include:spf.protection.outlook.com`.

**Internal mail has no signature but external does**
- The transport rule is probably scoped to
  `SentToScope: NotInOrganization`, so internal recipients skip the
  rule entirely. Clear it:
  ```powershell
  Set-TransportRule "Chaiiwala Signature Relay" -SentToScope $null
  ```

**Mail from a sender not in the DB never arrives at the recipient**
- This was a loop bug: the droplet used to relay non-DB messages
  unchanged, which meant the `X-ESP-Processed` header was missing
  and Exchange kept looping the message back until hop-count
  detection killed it. Fixed in `relay.ts` — every relayed message
  is now stamped with `X-ESP-Processed: v1` at the raw-buffer level,
  regardless of which code path produced it. If you see this come
  back, check you're on a build that includes commit `42b525e` or
  later.

**Recipient gets a `winmail.dat` attachment and no content**
- TNEF. Outlook sent the message as Rich Text / TNEF and Exchange
  passed it through to the droplet without converting. `mailparser`
  can't decode TNEF so the rebuilt MIME keeps it as an attachment.
- Fix once, org-wide:
  ```powershell
  Set-RemoteDomain Default -TNEFEnabled $false
  ```
  See Step D above.

**A sender re-enabled in the admin UI still has no signature for ~1 minute**
- Was caused by `sender-lookup.ts` caching null results for 60s.
  Fixed — the negative path no longer writes to the cache and a
  toggled sender is picked up on the very next email. Check you're
  on commit `3a6c49c` or later.

**"Signature not injected" in recipient email (but the email arrives plain)**
- Check mail-processor logs — was the sender email found in the DB?
  (`No matching sender in DB — rebuilding for relay (no signature)`)
- Verify the sender exists on the admin UI at
  https://your-vercel-url/senders, enabled, with the exact email
  that's being used as the From address (case-insensitive).

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

**Monitor alerts firing but everything looks fine**
- Check `tail -50 /var/log/mail-monitor.log` for the failure reason.
  Most common false-alarm causes:
  - Heartbeat URL ping failing because of a transient curl timeout
    (look for `WARN: heartbeat ping ... failed`). A single missed
    ping per hour is normal; UptimeRobot's 10-min grace window covers
    it. Sustained miss = real issue.
  - Cert renewal restarting the container during the probe window —
    health endpoint briefly unavailable. Self-resolves on next run.
- If the probe itself is broken (regex/parsing bug), run it manually
  with `bash -x .../smtp-health-probe.sh` to see which check fails.

**No monitor alerts but mail is clearly broken**
- Check the probe is actually running:
  `grep CRON /var/log/syslog | grep smtp-health-probe | tail -10`
- Check the heartbeat URL is set in `.env` and was loaded:
  `tail -5 /var/log/mail-monitor.log` — if you see "HEARTBEAT_URL not
  set", the cron didn't load `.env` correctly (check `ENV_FILE` path
  in the script matches your repo location).
- Verify the monitor itself is configured: log into UptimeRobot /
  Better Stack and check the last-seen timestamp.
