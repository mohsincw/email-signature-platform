"use client";

import { useEffect, useState } from "react";
import type { GlobalSettingsDto } from "@esp/shared-types";
import { api } from "@/lib/api";
import { ImageDropZone } from "../components/ImageDropZone";

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    api.settings.get().then(setSettings);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.settings.update(settings);
      setSettings(updated);
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      alert("Failed to save settings");
    }
    setSaving(false);
  };

  if (!settings) return <p>Loading...</p>;

  return (
    <div>
      <h2>Global Settings</h2>
      <p style={{ marginBottom: 24, color: "#737373", fontSize: 14 }}>
        These settings are shared across every signature in the organisation.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: 16 }}>Office Address</h3>
          <div className="form-group">
            <label>Address Line 1</label>
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
            <label>Address Line 2 (City / Postcode / Country)</label>
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

          <h3 style={{ marginTop: 28, marginBottom: 16 }}>Brand Assets</h3>
          <ImageDropZone
            label="Logo"
            kind="logo"
            value={settings.logoUrl}
            onChange={(url) => setSettings({ ...settings, logoUrl: url })}
            helpText="The chaiiwala logo with the kettle icon. Shown on the left side of every signature."
          />
          <ImageDropZone
            label="Badge (optional)"
            kind="badge"
            value={settings.badgeUrl}
            onChange={(url) => setSettings({ ...settings, badgeUrl: url })}
            helpText="Award badge shown below the logo (e.g. 5 Star Franchisee Satisfaction)."
          />

          <h3 style={{ marginTop: 28, marginBottom: 16 }}>Disclaimer</h3>
          <div className="form-group">
            <label>Email disclaimer / legal text</label>
            <textarea
              value={settings.disclaimer}
              onChange={(e) =>
                setSettings({ ...settings, disclaimer: e.target.value })
              }
              rows={6}
              placeholder="This email and any attachments are confidential and intended solely for the addressee..."
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: 13,
                fontFamily: "'Inter', sans-serif",
                borderRadius: 8,
                border: "1px solid #D4D4D4",
                resize: "vertical",
                lineHeight: 1.5,
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
              Plain text or basic HTML (e.g. <code>&lt;b&gt;</code>,{" "}
              <code>&lt;a href=&quot;...&quot;&gt;</code>). Appears in small grey
              text below every signature.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {savedAt && (
              <span style={{ fontSize: 12, color: "#16A34A" }}>
                Saved at {savedAt}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
