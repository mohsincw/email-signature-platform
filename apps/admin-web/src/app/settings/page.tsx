"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Cloud, Zap, AlertCircle } from "lucide-react";
import type { GlobalSettingsDto } from "@esp/shared-types";
import { api } from "@/lib/api";
import { ImageDropZone } from "../components/ImageDropZone";

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [original, setOriginal] = useState<GlobalSettingsDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [outlookConfigured, setOutlookConfigured] = useState(false);

  // Server-side mode state
  const [serverSideEnabled, setServerSideEnabled] = useState(false);
  const [serverSideStatusLoaded, setServerSideStatusLoaded] = useState(false);
  const [togglingServerSide, setTogglingServerSide] = useState(false);
  const [serverSideMsg, setServerSideMsg] = useState<string | null>(null);

  // Roaming Signatures state
  const [enablingRoaming, setEnablingRoaming] = useState(false);
  const [roamingMsg, setRoamingMsg] = useState<string | null>(null);

  useEffect(() => {
    api.settings.get().then((s) => {
      setSettings(s);
      setOriginal(s);
    });
    api.outlook
      .getStatus()
      .then((s) => {
        setOutlookConfigured(s.configured);
        if (s.configured) {
          api.admin
            .serverSideStatus()
            .then((st) => {
              setServerSideEnabled(st.enabled);
              setServerSideStatusLoaded(true);
            })
            .catch(() => {
              setServerSideEnabled(false);
              setServerSideStatusLoaded(true);
            });
        }
      })
      .catch(() => {});
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(original),
    [settings, original]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.settings.update(settings);
      setSettings(updated);
      setOriginal(updated);
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      alert("Failed to save settings");
    }
    setSaving(false);
  };

  const enableRoaming = async () => {
    if (
      !confirm(
        "Enable Roaming Signatures on your M365 tenant? This is a one-off and required for Outlook auto-deploy to work."
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

  const toggleServerSide = async () => {
    const turningOn = !serverSideEnabled;
    if (
      !confirm(
        turningOn
          ? "Enable Server-Side Mode? This appends a signature to every outbound email at the Exchange Online level. Wait ~5 min to propagate."
          : "Disable Server-Side Mode? Outbound emails will stop getting auto-appended signatures."
      )
    )
      return;
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

  if (!settings)
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">
            Brand assets, office address, disclaimer, and Outlook integration
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {savedAt && !dirty && (
            <span style={{ fontSize: 12, color: "var(--success)" }}>
              <Check size={12} style={{ display: "inline", marginRight: 4 }} />
              Saved {savedAt}
            </span>
          )}
          <button
            type="submit"
            form="settings-form"
            className="btn btn-primary"
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      <form id="settings-form" onSubmit={handleSubmit}>
        {/* ── Brand assets ─────────────────────────────────── */}
        <div className="card">
          <div className="card-title">Brand assets</div>
          <div className="card-subtitle">
            Logo and badge that appear in every signature. Drop files here or
            paste from your clipboard.
          </div>
          <div
            style={{
              display: "grid",
              gap: 20,
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <ImageDropZone
              label="Logo"
              kind="logo"
              value={settings.logoUrl}
              onChange={(url) => setSettings({ ...settings, logoUrl: url })}
            />
            <ImageDropZone
              label="Badge (optional)"
              kind="badge"
              value={settings.badgeUrl}
              onChange={(url) => setSettings({ ...settings, badgeUrl: url })}
            />
          </div>
        </div>

        {/* ── Office address ───────────────────────────────── */}
        <div className="card">
          <div className="card-title">Office</div>
          <div className="card-subtitle">
            Address and website used in every signature
          </div>
          <div className="form-group">
            <label>Address line 1</label>
            <input
              type="text"
              value={settings.addressLine1}
              onChange={(e) =>
                setSettings({ ...settings, addressLine1: e.target.value })
              }
              placeholder="90 Freemens Common Road"
            />
          </div>
          <div className="form-group">
            <label>Address line 2</label>
            <input
              type="text"
              value={settings.addressLine2}
              onChange={(e) =>
                setSettings({ ...settings, addressLine2: e.target.value })
              }
              placeholder="Leicester • LE2 7SQ • England"
            />
          </div>
          <div className="form-group">
            <label>Website</label>
            <input
              type="text"
              value={settings.website}
              onChange={(e) =>
                setSettings({ ...settings, website: e.target.value })
              }
              placeholder="www.chaiiwala.co.uk"
            />
          </div>
        </div>

        {/* ── Disclaimer ────────────────────────────────────── */}
        <div className="card">
          <div className="card-title">Email disclaimer</div>
          <div className="card-subtitle">
            Plain text or basic HTML. Renders as Arial 8pt italic grey below
            every signature.
          </div>
          <textarea
            value={settings.disclaimer}
            onChange={(e) =>
              setSettings({ ...settings, disclaimer: e.target.value })
            }
            rows={6}
            placeholder="This email and any attachments are confidential…"
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 13,
              fontFamily: "inherit",
              borderRadius: 8,
              border: "1px solid var(--grey-300)",
              resize: "vertical",
              lineHeight: 1.55,
              boxSizing: "border-box",
              color: "var(--grey-800)",
            }}
          />
        </div>
      </form>

      {/* ── Mail flow ─────────────────────────────────────── */}
      {outlookConfigured && (
        <div className="card">
          <div className="card-title">Mail flow</div>
          <div className="card-subtitle">
            Microsoft 365 integration toggles
          </div>

          {/* Roaming Signatures */}
          <div
            style={{
              display: "flex",
              gap: 16,
              padding: "16px 0",
              borderBottom: "1px solid var(--grey-100)",
              alignItems: "flex-start",
            }}
          >
            <Zap
              size={18}
              strokeWidth={2}
              style={{
                color: "var(--grey-500)",
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 500,
                  marginBottom: 2,
                  color: "var(--grey-900)",
                }}
              >
                Roaming Signatures
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--grey-500)",
                  marginBottom: 10,
                }}
              >
                One-off setup needed before any Outlook deploy works. Equivalent
                to <code>Set-OrganizationConfig -PostponeRoamingSignaturesUntilLater $false</code>.
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={enableRoaming}
                disabled={enablingRoaming}
              >
                {enablingRoaming ? "Enabling…" : "Enable Roaming Signatures"}
              </button>
              {roamingMsg && (
                <div
                  className={`banner ${
                    roamingMsg.startsWith("Failed")
                      ? "banner-danger"
                      : "banner-success"
                  }`}
                  style={{ marginTop: 12, marginBottom: 0 }}
                >
                  {roamingMsg}
                </div>
              )}
            </div>
          </div>

          {/* Server-side mode */}
          <div
            style={{
              display: "flex",
              gap: 16,
              padding: "16px 0 0",
              alignItems: "flex-start",
            }}
          >
            <Cloud
              size={18}
              strokeWidth={2}
              style={{
                color: "var(--grey-500)",
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 2,
                }}
              >
                <span style={{ fontWeight: 500, color: "var(--grey-900)" }}>
                  Server-Side Mode
                </span>
                {serverSideStatusLoaded && (
                  <span
                    className={`badge ${serverSideEnabled ? "badge-active" : "badge-inactive"}`}
                  >
                    {serverSideEnabled ? "Active" : "Inactive"}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--grey-500)",
                  marginBottom: 10,
                }}
              >
                Append a signature to every outbound email at the Exchange
                Online level — works on every device and email client.
                Recommended for organisation-wide rollout.
              </div>
              <button
                type="button"
                className={
                  serverSideEnabled
                    ? "btn btn-secondary btn-sm"
                    : "btn btn-primary btn-sm"
                }
                onClick={toggleServerSide}
                disabled={togglingServerSide}
              >
                {togglingServerSide
                  ? serverSideEnabled
                    ? "Disabling…"
                    : "Enabling…"
                  : serverSideEnabled
                  ? "Disable"
                  : "Enable"}
              </button>
              {serverSideMsg && (
                <div
                  className={`banner ${
                    serverSideMsg.startsWith("Failed")
                      ? "banner-danger"
                      : "banner-success"
                  }`}
                  style={{ marginTop: 12, marginBottom: 0 }}
                >
                  {serverSideMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!outlookConfigured && (
        <div className="banner banner-warning">
          <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            Outlook integration is not configured. Set <code>AZURE_TENANT_ID</code>,{" "}
            <code>AZURE_CLIENT_ID</code>, and <code>AZURE_CLIENT_SECRET</code>{" "}
            in Vercel to enable Mail flow features.
          </div>
        </div>
      )}
    </div>
  );
}
