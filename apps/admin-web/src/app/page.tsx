"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Settings as SettingsIcon,
  Sparkles,
  Upload,
  Cloud,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { GlobalSettingsDto, SenderDto } from "@esp/shared-types";
import { api } from "@/lib/api";

interface SetupCheck {
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

export default function DashboardPage() {
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [senders, setSenders] = useState<SenderDto[]>([]);
  const [outlookConfigured, setOutlookConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState<string | null>(null);
  const [enablingRoaming, setEnablingRoaming] = useState(false);
  const [roamingMsg, setRoamingMsg] = useState<string | null>(null);
  const [serverSideEnabled, setServerSideEnabled] = useState<boolean>(false);
  const [serverSideStatusLoaded, setServerSideStatusLoaded] = useState(false);
  const [togglingServerSide, setTogglingServerSide] = useState(false);
  const [serverSideMsg, setServerSideMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.settings.get().catch(() => null),
      api.senders.list().catch(() => []),
      api.outlook.getStatus().catch(() => ({ configured: false })),
    ]).then(([s, ss, o]) => {
      setSettings(s);
      setSenders(ss ?? []);
      setOutlookConfigured(o?.configured ?? false);
      setLoading(false);
      // Status check uses Exchange REST so only do it if Outlook is configured
      if (o?.configured) {
        api.admin
          .serverSideStatus()
          .then((s) => {
            setServerSideEnabled(s.enabled);
            setServerSideStatusLoaded(true);
          })
          .catch((err) => {
            // Failed to read transport rule status — usually because the
            // Azure app doesn't have Exchange.ManageAsApp + Exchange Admin
            // role assigned yet. Don't lock the button — let the user
            // click and surface the real error from the enable endpoint.
            setServerSideEnabled(false);
            setServerSideStatusLoaded(true);
            setServerSideMsg(
              `Could not read transport rule status: ${err?.message ?? "unknown"}. You can still try Enable below to see the full error.`
            );
          });
      } else {
        setServerSideStatusLoaded(true);
      }
    });
  }, []);

  if (loading) return <p>Loading...</p>;

  const checks: SetupCheck[] = [
    {
      label: "Upload your logo and badge",
      done: !!(settings?.logoUrl && settings?.badgeUrl),
      href: "/settings",
      cta: "Open Settings",
    },
    {
      label: "Set address, website and disclaimer",
      done: !!(settings?.addressLine1 && settings?.website && settings?.disclaimer),
      href: "/settings",
      cta: "Open Settings",
    },
    {
      label: "Add senders (or bulk import from a spreadsheet)",
      done: senders.length > 0,
      href: senders.length > 0 ? "/senders" : "/senders/import",
      cta: senders.length > 0 ? "Manage Senders" : "Bulk Import",
    },
    {
      label: "Connect Outlook auto-deploy (Azure AD env vars)",
      done: outlookConfigured,
      href: "/settings",
      cta: "Set up Outlook",
    },
  ];

  const allDone = checks.every((c) => c.done);
  const enabledCount = senders.filter((s) => s.enabled).length;
  const lastSuccess = senders.filter((s) => s.lastDeployedStatus === "success").length;
  const lastFail = senders.filter((s) => s.lastDeployedStatus === "failed").length;

  const toggleServerSide = async () => {
    const turningOn = !serverSideEnabled;
    if (turningOn) {
      if (
        !confirm(
          "Enable Server-Side Mode?\n\nThis creates an Exchange Online transport rule that automatically appends a Chaiiwala signature to every outbound email sent to external recipients — across all devices and clients (Outlook, mobile, web, third-party apps). Continue?"
        )
      )
        return;
    } else {
      if (
        !confirm(
          "Disable Server-Side Mode?\n\nThis removes the transport rule. Outbound emails will no longer get an auto-appended signature."
        )
      )
        return;
    }
    setTogglingServerSide(true);
    setServerSideMsg(null);
    try {
      const result = turningOn
        ? await api.admin.enableServerSide()
        : await api.admin.disableServerSide();
      setServerSideMsg(result.message);
      setServerSideEnabled(turningOn);
    } catch (err: any) {
      setServerSideMsg(`Failed: ${err.message}`);
    } finally {
      setTogglingServerSide(false);
    }
  };

  const enableRoaming = async () => {
    if (
      !confirm(
        "This will run Set-OrganizationConfig -PostponeRoamingSignaturesUntilLater $false on your M365 tenant via Microsoft Graph. Continue?"
      )
    )
      return;
    setEnablingRoaming(true);
    setRoamingMsg(null);
    try {
      const result = await api.admin.enableRoamingSignatures();
      setRoamingMsg(result.message);
    } catch (err: any) {
      setRoamingMsg(`Failed: ${err.message}`);
    } finally {
      setEnablingRoaming(false);
    }
  };

  const deployAll = async () => {
    if (enabledCount === 0) return;
    setDeploying(true);
    setDeployMsg(null);
    try {
      const ids = senders.filter((s) => s.enabled).map((s) => s.id);
      const results = await api.outlook.deploy(ids);
      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      setDeployMsg(
        fail === 0
          ? `Deployed ${ok} signature${ok !== 1 ? "s" : ""} to Outlook`
          : `${ok} succeeded, ${fail} failed`
      );
      const fresh = await api.senders.list();
      setSenders(fresh);
    } catch (err: any) {
      setDeployMsg(`Deploy failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div>
      <h2>Dashboard</h2>

      {!allDone && (
        <div
          style={{
            marginTop: 16,
            marginBottom: 24,
            padding: 20,
            borderRadius: 12,
            border: "1px solid #FCD34D",
            background: "#FFFBEB",
          }}
        >
          <h3 style={{ marginBottom: 4 }}>Finish setting up</h3>
          <p style={{ fontSize: 13, color: "#92400E", marginBottom: 14 }}>
            Complete these steps to start deploying signatures.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {checks.map((c) => (
              <li
                key={c.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: "1px solid #FDE68A",
                }}
              >
                {c.done ? (
                  <CheckCircle2
                    size={18}
                    strokeWidth={2.5}
                    color="#16A34A"
                  />
                ) : (
                  <AlertCircle size={18} strokeWidth={2.5} color="#D97706" />
                )}
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: c.done ? "#737373" : "#1F2937",
                    textDecoration: c.done ? "line-through" : "none",
                  }}
                >
                  {c.label}
                </span>
                {!c.done && (
                  <Link href={c.href} className="btn btn-secondary">
                    {c.cta}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Total senders"
          value={senders.length.toString()}
          sub={`${enabledCount} enabled`}
        />
        <StatCard
          label="Successfully deployed"
          value={lastSuccess.toString()}
          sub={`out of ${senders.length}`}
          color="#16A34A"
        />
        <StatCard
          label="Failed last deploy"
          value={lastFail.toString()}
          sub={lastFail === 0 ? "all good" : "needs attention"}
          color={lastFail > 0 ? "#DC2626" : undefined}
        />
        <StatCard
          label="Outlook integration"
          value={outlookConfigured ? "Connected" : "Not configured"}
          sub={outlookConfigured ? "✓ ready" : "Set Azure env vars"}
          color={outlookConfigured ? "#16A34A" : "#A3A3A3"}
        />
      </div>

      {/* Quick actions */}
      <h3 style={{ marginBottom: 12 }}>Quick actions</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <ActionCard
          icon={Sparkles}
          title="Generate signature"
          desc="Live preview and copy HTML"
          href="/generate"
        />
        <ActionCard
          icon={Users}
          title="Add a sender"
          desc="Add one person manually"
          href="/senders/new"
        />
        <ActionCard
          icon={Upload}
          title="Bulk import"
          desc="Paste rows from Excel"
          href="/senders/import"
        />
        <ActionCard
          icon={SettingsIcon}
          title="Global settings"
          desc="Logo, badge, address, disclaimer"
          href="/settings"
        />
      </div>

      {/* Tenant setup — Roaming Signatures */}
      {outlookConfigured && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Tenant setup</h3>
          <p style={{ fontSize: 13, color: "#737373", marginBottom: 16 }}>
            One-time fix: enable Microsoft 365 Roaming Signatures for your
            tenant. Required before "Deploy to Outlook" works. Equivalent to
            running <code>Set-OrganizationConfig -PostponeRoamingSignaturesUntilLater $false</code>{" "}
            in PowerShell.
          </p>
          <button
            className="btn btn-secondary"
            onClick={enableRoaming}
            disabled={enablingRoaming}
          >
            {enablingRoaming ? "Enabling…" : "Enable Roaming Signatures"}
          </button>
          {roamingMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                background: roamingMsg.startsWith("Failed") ? "#FEF2F2" : "#F0FDF4",
                color: roamingMsg.startsWith("Failed") ? "#DC2626" : "#16A34A",
                border: `1px solid ${
                  roamingMsg.startsWith("Failed") ? "#FECACA" : "#BBF7D0"
                }`,
              }}
            >
              {roamingMsg}
            </div>
          )}
        </div>
      )}

      {/* Server-side mode */}
      {outlookConfigured && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0 }}>Server-Side Mode</h3>
            {serverSideStatusLoaded && serverSideEnabled === true && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#16A34A",
                  background: "#F0FDF4",
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #BBF7D0",
                }}
              >
                ✓ Active
              </span>
            )}
            {serverSideStatusLoaded && serverSideEnabled === false && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#737373",
                  background: "#F5F5F5",
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #E5E5E5",
                }}
              >
                Inactive
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "#737373", marginBottom: 16 }}>
            Append a signature to <strong>every outbound email</strong> at the
            Exchange Online level — works on every client (Outlook desktop /
            web / mobile / iOS Mail / third-party apps) without any per-user
            setup. Uses a single transport rule that hot-links each sender's
            personalised PNG. Recommended for organisation-wide rollout.
          </p>
          <button
            className={
              serverSideEnabled ? "btn btn-secondary" : "btn btn-primary"
            }
            onClick={toggleServerSide}
            disabled={togglingServerSide}
          >
            {togglingServerSide
              ? serverSideEnabled
                ? "Disabling…"
                : "Enabling…"
              : serverSideEnabled
              ? "Disable Server-Side Mode"
              : "Enable Server-Side Mode"}
          </button>
          {serverSideMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                background: serverSideMsg.startsWith("Failed")
                  ? "#FEF2F2"
                  : "#F0FDF4",
                color: serverSideMsg.startsWith("Failed")
                  ? "#DC2626"
                  : "#16A34A",
                border: `1px solid ${
                  serverSideMsg.startsWith("Failed") ? "#FECACA" : "#BBF7D0"
                }`,
              }}
            >
              {serverSideMsg}
            </div>
          )}
        </div>
      )}

      {/* Deploy all */}
      {outlookConfigured && enabledCount > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Deploy to Outlook</h3>
          <p style={{ fontSize: 13, color: "#737373", marginBottom: 16 }}>
            Push every enabled sender's signature into their M365 mailbox via
            Microsoft Graph. This is the same as selecting all on the senders
            page and clicking Deploy.
          </p>
          <button
            className="btn btn-primary"
            onClick={deployAll}
            disabled={deploying}
          >
            <Cloud size={16} strokeWidth={2} />
            {deploying ? "Deploying..." : `Deploy all (${enabledCount})`}
          </button>
          {deployMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                background: deployMsg.includes("failed") ? "#FEF2F2" : "#F0FDF4",
                color: deployMsg.includes("failed") ? "#DC2626" : "#16A34A",
                border: `1px solid ${
                  deployMsg.includes("failed") ? "#FECACA" : "#BBF7D0"
                }`,
              }}
            >
              {deployMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: "#737373", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? "#000" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#A3A3A3", marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  desc,
  href,
}: {
  icon: any;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card"
      style={{
        padding: 16,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        transition: "border-color 0.15s",
      }}
    >
      <Icon size={20} strokeWidth={2} />
      <div style={{ fontWeight: 600, marginTop: 8 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#737373", marginTop: 2 }}>{desc}</div>
    </Link>
  );
}
