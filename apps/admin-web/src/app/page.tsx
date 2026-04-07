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
