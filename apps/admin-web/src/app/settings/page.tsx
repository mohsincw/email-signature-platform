"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Key } from "lucide-react";
import type { GlobalSettingsDto } from "@esp/shared-types";
import { api, type AdminUserDto } from "@/lib/api";
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

      {/* ── Team PINs ──────────────────────────────────────── */}
      <TeamPins />
    </div>
  );
}

function TeamPins() {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.admin
      .listUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSetPin = async (userId: string) => {
    if (!/^\d{4,8}$/.test(pinInput)) {
      alert("PIN must be 4–8 digits");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.admin.updateUserPin(userId, pinInput);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingId(null);
      setPinInput("");
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
    setSaving(false);
  };

  const handleClearPin = async (userId: string) => {
    setSaving(true);
    try {
      const updated = await api.admin.updateUserPin(userId, null);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
    setSaving(false);
  };

  return (
    <div className="card">
      <div className="card-title">team login PINs</div>
      <div className="card-subtitle">
        Set a numeric PIN for each admin user so they can log in when
        email delivery is unavailable. PINs must be 4–8 digits.
      </div>
      {loading ? (
        <p className="muted" style={{ fontSize: 13 }}>
          Loading users…
        </p>
      ) : users.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          No admin users found.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                background: "var(--karak-beige-50)",
                borderRadius: 10,
                border: "1px solid var(--karak-beige-200)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 14,
                    color: "var(--grey-900)",
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--grey-500)",
                    marginTop: 2,
                  }}
                >
                  {user.email}
                </div>
              </div>

              {editingId === user.id ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={pinInput}
                    onChange={(e) =>
                      setPinInput(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="e.g. 1234"
                    autoFocus
                    style={{
                      width: 90,
                      padding: "6px 10px",
                      fontSize: 14,
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: 3,
                      textAlign: "center",
                      border: "1px solid var(--karak-beige-200)",
                      borderRadius: 8,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSetPin(user.id);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setPinInput("");
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={saving || pinInput.length < 4}
                    onClick={() => handleSetPin(user.id)}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditingId(null);
                      setPinInput("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {user.pin ? (
                    <>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 15,
                          letterSpacing: 3,
                          color: "var(--grey-800)",
                          background: "var(--white)",
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--karak-beige-200)",
                        }}
                      >
                        {user.pin}
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingId(user.id);
                          setPinInput(user.pin || "");
                        }}
                      >
                        Change
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: "var(--danger)" }}
                        onClick={() => handleClearPin(user.id)}
                        disabled={saving}
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingId(user.id);
                        setPinInput("");
                      }}
                    >
                      <Key size={13} />
                      Set PIN
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
