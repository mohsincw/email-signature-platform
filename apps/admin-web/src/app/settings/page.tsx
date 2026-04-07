"use client";

import { useEffect, useState } from "react";
import type { GlobalSettingsDto } from "@esp/shared-types";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [saving, setSaving] = useState(false);

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
      alert("Settings saved");
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
        These settings are shared across all signatures in the organisation.
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
          <div className="form-group">
            <label>Logo Image URL</label>
            <input
              type="url"
              value={settings.logoUrl}
              onChange={(e) =>
                setSettings({ ...settings, logoUrl: e.target.value })
              }
              placeholder="https://your-cdn.com/chaiiwala-logo.png"
            />
            <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
              The chaiiwala logo with kettle icon shown on the left side of the signature.
            </p>
          </div>
          <div className="form-group">
            <label>Badge Image URL (optional)</label>
            <input
              type="url"
              value={settings.badgeUrl}
              onChange={(e) =>
                setSettings({ ...settings, badgeUrl: e.target.value })
              }
              placeholder="https://your-cdn.com/5-star-badge.png"
            />
            <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
              Award badge shown below the logo (e.g. 5 Star Franchisee Satisfaction).
            </p>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
