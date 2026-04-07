"use client";

import { useEffect, useState, useRef } from "react";
import { Copy, CheckCircle } from "lucide-react";
import type { SenderDto, GlobalSettingsDto } from "@esp/shared-types";
import { api } from "@/lib/api";

export default function GeneratePage() {
  const [senders, setSenders] = useState<SenderDto[]>([]);
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");

  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<NodeJS.Timeout | null>(null);

  const fallbackSettings: GlobalSettingsDto = {
    addressLine1: "90 Freemens Common Road",
    addressLine2: "Leicester \u2022 LE2 7SQ \u2022 England",
    website: "www.chaiiwala.co.uk",
    logoUrl: "",
    badgeUrl: "",
    disclaimer: "",
  };

  useEffect(() => {
    api.senders.list().then(setSenders).catch(() => {});
    api.settings.get().then(setSettings).catch(() => setSettings(fallbackSettings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = settings ?? fallbackSettings;

  const handleSenderSelect = (id: string) => {
    setSelectedId(id);
    setCopied(false);
    if (!id) { setName(""); setTitle(""); setPhone(""); return; }
    const sender = senders.find((x) => x.id === id);
    if (sender) {
      setName(sender.name);
      setTitle(sender.title ?? "");
      setPhone(sender.phone ?? "");
    }
  };

  const handleCopyHtml = async () => {
    try {
      const { html } = await api.senders.renderSignature({
        name: name || "Full Name",
        title: title || undefined,
        phone: phone || undefined,
      });
      await navigator.clipboard.writeText(html);
      setCopied(true);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      alert("Failed to copy");
    }
  };

  const logoSrc = s.logoUrl || "/sig-logo.png";
  const badgeSrc = s.badgeUrl || "/sig-badge.png";

  const font = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <div>
      <div className="top-bar">
        <div>
          <h1>Generate Signature</h1>
          <p className="page-subtitle">Click name, title, or phone to edit. Everything else is fixed.</p>
        </div>
      </div>

      {/* Sender picker */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Load from existing sender</label>
          <select value={selectedId} onChange={(e) => handleSenderSelect(e.target.value)}>
            <option value="">-- Start blank or choose a sender --</option>
            {senders.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── THE SIGNATURE ─── exact replica ─── */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "32px 40px", background: "#fff", borderRadius: 12 }}>
          <table cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                {/* ── LEFT: logo + badge ── */}
                <td style={{ verticalAlign: "top", paddingRight: 24, borderRight: "2px solid #000000", width: 150 }} valign="top">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoSrc}
                    alt="chaiiwala"
                    width={140}
                    style={{ display: "block", width: 140, height: "auto" }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeSrc}
                    alt="5 Star Franchisee Satisfaction"
                    width={120}
                    style={{ display: "block", width: 120, height: "auto", marginTop: 10 }}
                  />
                </td>

                {/* ── RIGHT: editable contact details ── */}
                <td style={{ verticalAlign: "top", paddingLeft: 24 }} valign="top">

                  {/* NAME */}
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setCopied(false); }}
                    placeholder="full name"
                    style={{
                      display: "block",
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      padding: 0,
                      margin: "0 0 6px",
                      fontFamily: font,
                      fontSize: 30,
                      fontWeight: 700,
                      color: "#000",
                      lineHeight: 1.15,
                      boxSizing: "border-box",
                    }}
                  />

                  {/* TITLE */}
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setCopied(false); }}
                    placeholder="JOB TITLE"
                    style={{
                      display: "block",
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      padding: 0,
                      margin: "0 0 18px",
                      fontFamily: font,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#000",
                      textTransform: "uppercase",
                      letterSpacing: 3,
                      lineHeight: 1.3,
                      boxSizing: "border-box",
                    }}
                  />

                  {/* PHONE */}
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setCopied(false); }}
                    placeholder="+44 (0) XXXX XXX XXX"
                    style={{
                      display: "block",
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      padding: 0,
                      margin: "0 0 28px",
                      fontFamily: font,
                      fontSize: 26,
                      fontWeight: 700,
                      color: "#000",
                      lineHeight: 1.2,
                      boxSizing: "border-box",
                    }}
                  />

                  {/* ADDRESS LINE 1 */}
                  <p style={{
                    margin: 0,
                    fontFamily: font,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#000",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    lineHeight: 1.6,
                  }}>
                    {s.addressLine1}
                  </p>

                  {/* ADDRESS LINE 2 */}
                  <p style={{
                    margin: "0 0 22px",
                    fontFamily: font,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#000",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    lineHeight: 1.6,
                  }}>
                    {s.addressLine2}
                  </p>

                  {/* WEBSITE */}
                  <p style={{
                    margin: 0,
                    fontFamily: font,
                    fontSize: 16,
                    fontWeight: 400,
                    color: "#000",
                    lineHeight: 1.2,
                  }}>
                    www.<span style={{ fontWeight: 800, fontSize: 20 }}>chaiiwala</span>.co.uk
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Copy button */}
      <div style={{ marginTop: 16 }}>
        <button
          className="btn btn-primary"
          onClick={handleCopyHtml}
          disabled={!name}
          style={{ minWidth: 180 }}
        >
          {copied ? <CheckCircle size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={2} />}
          {copied ? "Copied!" : "Copy Signature HTML"}
        </button>
      </div>
    </div>
  );
}
