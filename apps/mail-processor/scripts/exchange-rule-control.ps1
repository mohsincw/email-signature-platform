# ─────────────────────────────────────────────────────────────────────
# exchange-rule-control.ps1
#
# Manages the Chaiiwala Signature Relay transport rule via Exchange
# Online PowerShell, using certificate-based app-only authentication
# (no admin password required at runtime).
#
# Called from disable-relay-rule.sh and enable-relay-rule.sh — also
# usable directly for ad-hoc Status checks.
#
# Required env vars (loaded from mail-processor/.env by the wrappers):
#   EXCHANGE_APP_ID         — Application (client) ID from Azure AD
#   EXCHANGE_APP_TENANT     — Tenant ID or chaiiwala.onmicrosoft.com
#   EXCHANGE_APP_CERT_PATH  — Path to the .pfx certificate file
#   EXCHANGE_APP_CERT_PASSWORD  — (optional) password for the .pfx
#   EXCHANGE_RULE_NAME      — Name of the transport rule to manage
#                             (default: "Chaiiwala Signature Relay")
# ─────────────────────────────────────────────────────────────────────

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('Disable', 'Enable', 'Status')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'

$AppId = $env:EXCHANGE_APP_ID
$Tenant = $env:EXCHANGE_APP_TENANT
$CertPath = $env:EXCHANGE_APP_CERT_PATH
$CertPassword = $env:EXCHANGE_APP_CERT_PASSWORD
$RuleName = if ($env:EXCHANGE_RULE_NAME) { $env:EXCHANGE_RULE_NAME } else { "Chaiiwala Signature Relay" }

if (-not $AppId -or -not $Tenant -or -not $CertPath) {
    Write-Error "Missing required env vars: EXCHANGE_APP_ID, EXCHANGE_APP_TENANT, EXCHANGE_APP_CERT_PATH"
    exit 2
}

if (-not (Test-Path $CertPath)) {
    Write-Error "Certificate file not found at: $CertPath"
    exit 2
}

# Load the .pfx (with optional password)
if ($CertPassword) {
    $securePassword = ConvertTo-SecureString -String $CertPassword -AsPlainText -Force
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CertPath, $securePassword)
} else {
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CertPath)
}

# Connect to Exchange Online with app-only auth. ShowBanner suppressed
# to keep cron output tidy.
Connect-ExchangeOnline `
    -AppId $AppId `
    -Certificate $cert `
    -Organization $Tenant `
    -ShowBanner:$false | Out-Null

try {
    switch ($Action) {
        'Disable' {
            Set-TransportRule -Identity $RuleName -State Disabled
            Write-Host "DISABLED: $RuleName"
        }
        'Enable' {
            Set-TransportRule -Identity $RuleName -State Enabled
            Write-Host "ENABLED: $RuleName"
        }
        'Status' {
            $rule = Get-TransportRule -Identity $RuleName
            Write-Host "STATE: $($rule.State)"
        }
    }
} finally {
    Disconnect-ExchangeOnline -Confirm:$false | Out-Null
}
