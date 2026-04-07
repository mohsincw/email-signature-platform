"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { GlobalSettingsDto } from "@esp/shared-types";
import { api } from "@/lib/api";
import { ImageDropZone } from "../components/ImageDropZone";

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [original, setOriginal] = useState<GlobalSettingsDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    api.settings.get().then((s) => {
      setSettings(s);
      setOriginal(s);
    });
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
          <div className="page-title">settings</div>
          <div className="page-subtitle">
            Brand assets, office address, and legal disclaimer applied to
            every signature
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
          <div className="card-title">brand assets</div>
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
          <div className="card-title">office</div>
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
          <div className="card-title">email disclaimer</div>
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
              borderRadius: 10,
              border: "1px solid var(--karak-beige-200)",
              resize: "vertical",
              lineHeight: 1.55,
              boxSizing: "border-box",
              color: "var(--grey-800)",
            }}
          />
        </div>
      </form>
    </div>
  );
}
