"use client";

import { useEffect, useState, useRef } from "react";
import { Copy, CheckCircle, Image as ImageIcon, Eye, Code, Mail } from "lucide-react";
import type { SenderDto, GlobalSettingsDto } from "@esp/shared-types";
import { api } from "@/lib/api";

type ViewMode = "live" | "html" | "thread";

export default function GeneratePage() {
  const [senders, setSenders] = useState<SenderDto[]>([]);
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");

  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<NodeJS.Timeout | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [renderingHtml, setRenderingHtml] = useState(false);

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

  // Re-render HTML on the server whenever the inputs change AND we're
  // looking at the HTML or Email thread view. Debounced 300ms so typing
  // doesn't hammer the API.
  useEffect(() => {
    if (viewMode === "live") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setRenderingHtml(true);
      try {
        const { html } = await api.senders.renderSignature({
          name: name || "Full Name",
          title: title || undefined,
          phone: phone || undefined,
        });
        if (!cancelled) setRenderedHtml(html);
      } catch {
        if (!cancelled) setRenderedHtml("<!-- failed to render -->");
      } finally {
        if (!cancelled) setRenderingHtml(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [viewMode, name, title, phone]);

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

  const font =
    "'Myriad Pro', 'Source Sans Pro', 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

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

      {/* View mode tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 12,
          borderBottom: "1px solid #E5E5E5",
        }}
      >
        {(
          [
            { id: "live", label: "Live preview", icon: Eye },
            { id: "html", label: "HTML source", icon: Code },
            { id: "thread", label: "In an email", icon: Mail },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setViewMode(id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              border: "none",
              background: "transparent",
              fontSize: 13,
              fontWeight: 500,
              color: viewMode === id ? "#000" : "#737373",
              borderBottom:
                viewMode === id ? "2px solid #000" : "2px solid transparent",
              marginBottom: -1,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Icon size={14} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {/* ─── THE SIGNATURE ─── live editable preview ─── */}
      <div
        className="card"
        style={{ padding: 0, display: viewMode === "live" ? "block" : "none" }}
      >
        <div style={{ padding: "32px 40px", background: "#fff", borderRadius: 12 }}>
          <table cellPadding={0} cellSpacing={0} border={0} style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                {/* ── LEFT: logo + badge ── centred horizontally and vertically */}
                <td
                  align="center"
                  style={{
                    verticalAlign: "middle",
                    textAlign: "center",
                    padding: "0 28px 0 0",
                    borderRight: "2px solid #000000",
                    width: 200,
                  }}
                  valign="middle"
                  width={200}
                >
                  <div
                    style={{
                      width: 170,
                      textAlign: "center",
                      margin: "0 auto",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoSrc}
                      alt="chaiiwala"
                      width={140}
                      style={{ display: "block", width: 140, height: "auto", margin: "0 auto" }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={badgeSrc}
                      alt="5 Star Franchisee Satisfaction"
                      width={120}
                      style={{ display: "block", width: 120, height: "auto", margin: "14px auto 0" }}
                    />
                  </div>
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
                      letterSpacing: 2,
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
                    letterSpacing: 1.5,
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
                    letterSpacing: 1.5,
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
          {s.disclaimer && (
            <div
              style={{
                marginTop: 6,
                maxWidth: 640,
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: 8,
                fontStyle: "italic",
                lineHeight: 1.5,
                color: "#333333",
              }}
              dangerouslySetInnerHTML={{ __html: s.disclaimer }}
            />
          )}
        </div>
      </div>

      {/* ─── HTML source view ─── */}
      {viewMode === "html" && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #E5E5E5",
              fontSize: 12,
              color: "#737373",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>
              {renderingHtml
                ? "Rendering…"
                : "Read-only HTML rendered server-side. Click 'Copy Signature HTML' below to copy."}
            </span>
            <span style={{ fontSize: 11, color: "#A3A3A3" }}>
              {renderedHtml.length} chars
            </span>
          </div>
          <pre
            style={{
              margin: 0,
              padding: 20,
              background: "#0B1020",
              color: "#E5E7EB",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12,
              lineHeight: 1.6,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
              maxHeight: 480,
              overflowY: "auto",
            }}
          >
            {renderedHtml || "(empty)"}
          </pre>
        </div>
      )}

      {/* ─── Sample email thread view ─── shows the signature inside a fake email so you can sanity-check spacing/colors ─── */}
      {viewMode === "thread" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Fake mail-client chrome */}
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #E5E5E5",
              background: "#FAFAFA",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#171717",
                marginBottom: 12,
              }}
            >
              Quick question about next week's launch
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: 13,
                color: "#525252",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#000",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {(name || "FN")
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#171717", fontWeight: 500 }}>
                  {name || "Full Name"}{" "}
                  <span style={{ color: "#A3A3A3", fontWeight: 400 }}>
                    &lt;
                    {selectedId
                      ? senders.find((x) => x.id === selectedId)?.email
                      : "you@chaiiwala.co.uk"}
                    &gt;
                  </span>
                </div>
                <div style={{ color: "#A3A3A3", fontSize: 12, marginTop: 2 }}>
                  to client@example.com &middot; just now
                </div>
              </div>
            </div>
          </div>

          {/* Fake email body */}
          <div
            style={{
              padding: "28px 32px",
              background: "#fff",
              fontFamily:
                "'Aptos', 'Segoe UI', Calibri, Arial, sans-serif",
              fontSize: 14,
              color: "#171717",
              lineHeight: 1.55,
            }}
          >
            <p style={{ margin: "0 0 14px" }}>Hi Sarah,</p>
            <p style={{ margin: "0 0 14px" }}>
              Just wanted to follow up on the quick question about next week's
              launch — happy to jump on a call tomorrow afternoon if that
              works for you. Let me know what time suits.
            </p>
            <p style={{ margin: "0 0 14px" }}>Thanks,</p>
            <p style={{ margin: "0 0 24px" }}>{name || "Full Name"}</p>

            {/* The actual signature, rendered identically to what gets sent */}
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          className="btn btn-primary"
          onClick={handleCopyHtml}
          disabled={!name}
          style={{ minWidth: 180 }}
        >
          {copied ? <CheckCircle size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={2} />}
          {copied ? "Copied!" : "Copy Signature HTML"}
        </button>
        {selectedId && (
          <a
            className="btn btn-secondary"
            href={`/api/senders/${selectedId}/preview.png`}
            target="_blank"
            rel="noreferrer"
            download={`${name || "signature"}.png`}
          >
            <ImageIcon size={16} strokeWidth={2} />
            Download PNG (pixel-perfect)
          </a>
        )}
      </div>
      <p style={{ marginTop: 8, fontSize: 11, color: "#A3A3A3" }}>
        The PNG is rendered server-side using the actual Myriad Pro font, so it
        looks identical to your designer's image — but downloading requires the
        sender to be saved (pick from the dropdown above).
      </p>
    </div>
  );
}
