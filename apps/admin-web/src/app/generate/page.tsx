"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Check,
  Image as ImageIcon,
  Eye,
  Code,
  Mail,
  Search,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { GlobalSettingsDto, SenderDto } from "@esp/shared-types";
import { api } from "@/lib/api";

type ViewMode = "live" | "html" | "thread";

export default function EditorPage() {
  const searchParams = useSearchParams();
  const querySenderId = searchParams.get("senderId") ?? "";
  const [senders, setSenders] = useState<SenderDto[]>([]);
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");

  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<NodeJS.Timeout | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [renderedHtml, setRenderedHtml] = useState("");

  const fallbackSettings: GlobalSettingsDto = {
    addressLine1: "90 Freemens Common Road",
    addressLine2: "Leicester • LE2 7SQ • England",
    website: "www.chaiiwala.co.uk",
    logoUrl: "",
    badgeUrl: "",
    disclaimer: "",
  };

  useEffect(() => {
    api.senders
      .list()
      .then((list) => {
        setSenders(list);
        // If we arrived here via a ?senderId=... link (e.g. the
        // "Preview Signature" button on the edit page), preselect that
        // sender so the preview populates immediately.
        if (querySenderId) {
          const hit = list.find((x) => x.id === querySenderId);
          if (hit) {
            setSelectedId(hit.id);
            setName(hit.name);
            setTitle(hit.title ?? "");
            setPhone(hit.phone ?? "");
          }
        }
      })
      .catch(() => {});
    api.settings
      .get()
      .then(setSettings)
      .catch(() => setSettings(fallbackSettings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [querySenderId]);

  // Re-render HTML server-side whenever inputs change AND we're in HTML/thread view
  useEffect(() => {
    if (viewMode === "live") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { html } = await api.senders.renderSignature({
          name: name || "Full Name",
          title: title || undefined,
          phone: phone || undefined,
        });
        if (!cancelled) setRenderedHtml(html);
      } catch {
        if (!cancelled) setRenderedHtml("<!-- failed to render -->");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [viewMode, name, title, phone]);

  const s = settings ?? fallbackSettings;

  const filteredSenders = useMemo(() => {
    if (!search.trim()) return senders;
    const q = search.toLowerCase();
    return senders.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.email.toLowerCase().includes(q) ||
        (x.title ?? "").toLowerCase().includes(q)
    );
  }, [senders, search]);

  const handleSenderSelect = (id: string) => {
    setSelectedId(id);
    setCopied(false);
    if (!id) {
      setName("");
      setTitle("");
      setPhone("");
      return;
    }
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
      copyTimeout.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Failed to copy");
    }
  };

  const logoSrc = s.logoUrl || "/sig-logo.png";
  const badgeSrc = s.badgeUrl || "/sig-badge.png";
  const sigFont =
    "'Myriad Pro', 'Source Sans Pro', 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Left rail: sender list ───────────────────────────── */}
      <aside
        style={{
          width: 280,
          background: "var(--white)",
          borderRight: "1px solid var(--grey-200)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "20px 20px 12px",
            borderBottom: "1px solid var(--grey-100)",
          }}
        >
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 15 }}>People</h2>
            <Link
              href="/senders/new"
              className="btn btn-ghost btn-icon"
              title="Add person"
            >
              <Plus size={16} strokeWidth={2.5} />
            </Link>
          </div>
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              strokeWidth={2}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--grey-400)",
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                fontSize: 13,
                border: "1px solid var(--grey-200)",
                borderRadius: 8,
                background: "var(--grey-50)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <button
            onClick={() => handleSenderSelect("")}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "12px 20px",
              border: "none",
              background: !selectedId ? "var(--grey-100)" : "transparent",
              cursor: "pointer",
              fontSize: 13,
              color: !selectedId ? "var(--grey-900)" : "var(--grey-500)",
              fontWeight: !selectedId ? 500 : 400,
            }}
          >
            New / blank
          </button>
          {filteredSenders.map((x) => {
            const active = x.id === selectedId;
            return (
              <button
                key={x.id}
                onClick={() => handleSenderSelect(x.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 20px",
                  border: "none",
                  borderLeft: active
                    ? "2px solid var(--black)"
                    : "2px solid transparent",
                  background: active ? "var(--grey-100)" : "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--grey-900)",
                    marginBottom: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textTransform: "lowercase",
                  }}
                >
                  {x.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--grey-500)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textTransform: "lowercase",
                  }}
                >
                  {x.title || x.email}
                </div>
              </button>
            );
          })}
          {filteredSenders.length === 0 && (
            <div
              style={{
                padding: 20,
                fontSize: 13,
                color: "var(--grey-500)",
                textAlign: "center",
              }}
            >
              No people yet.
              <br />
              <Link
                href="/senders/import"
                style={{
                  color: "var(--grey-900)",
                  textDecoration: "underline",
                  fontSize: 12,
                }}
              >
                Bulk import
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main editor area ─────────────────────────────────── */}
      <div style={{ flex: 1, padding: "40px 48px 80px", minWidth: 0 }}>
        <div className="page-header">
          <div>
            <div className="page-title">editor</div>
            <div className="page-subtitle">
              {selectedId
                ? `Editing ${name}`
                : "Pick a person from the list, or start blank"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleCopyHtml}
              className="btn btn-secondary"
              disabled={!name}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy HTML"}
            </button>
            {selectedId && (
              <a
                href={`/api/senders/${selectedId}/preview.png`}
                target="_blank"
                rel="noreferrer"
                download={`${name || "signature"}.png`}
                className="btn btn-primary"
              >
                <ImageIcon size={14} />
                Download PNG
              </a>
            )}
          </div>
        </div>

        {/* View mode tabs */}
        <div
          style={{
            display: "flex",
            gap: 2,
            marginBottom: 20,
            borderBottom: "1px solid var(--grey-200)",
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
                color: viewMode === id ? "var(--grey-900)" : "var(--grey-500)",
                borderBottom:
                  viewMode === id
                    ? "2px solid var(--grey-900)"
                    : "2px solid transparent",
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

        {/* Live editable preview */}
        {viewMode === "live" && (
          <div className="card">
            <div
              style={{
                padding: "32px 40px",
                background: "var(--white)",
              }}
            >
              <table
                cellPadding={0}
                cellSpacing={0}
                border={0}
                style={{ borderCollapse: "collapse" }}
              >
                <tbody>
                  <tr>
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
                          style={{
                            display: "block",
                            width: 140,
                            height: "auto",
                            margin: "0 auto",
                          }}
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={badgeSrc}
                          alt="badge"
                          width={120}
                          style={{
                            display: "block",
                            width: 120,
                            height: "auto",
                            margin: "14px auto 0",
                          }}
                        />
                      </div>
                    </td>
                    <td
                      style={{ verticalAlign: "top", paddingLeft: 24 }}
                      valign="top"
                    >
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setCopied(false);
                        }}
                        placeholder="full name"
                        style={{
                          display: "block",
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          padding: 0,
                          margin: "0 0 6px",
                          fontFamily: sigFont,
                          fontSize: 30,
                          fontWeight: 700,
                          color: "#000",
                          lineHeight: 1.15,
                          boxSizing: "border-box",
                          textTransform: "lowercase",
                        }}
                      />
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          setCopied(false);
                        }}
                        placeholder="job title"
                        style={{
                          display: "block",
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          padding: 0,
                          margin: "0 0 18px",
                          fontFamily: sigFont,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#000",
                          textTransform: "lowercase",
                          letterSpacing: 1.5,
                          lineHeight: 1.3,
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setCopied(false);
                        }}
                        placeholder="+44 (0) XXXX XXX XXX"
                        style={{
                          display: "block",
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          padding: 0,
                          margin: "0 0 28px",
                          fontFamily: sigFont,
                          fontSize: 26,
                          fontWeight: 700,
                          color: "#000",
                          lineHeight: 1.2,
                          boxSizing: "border-box",
                        }}
                      />
                      <p
                        style={{
                          margin: 0,
                          fontFamily: sigFont,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#000",
                          textTransform: "uppercase",
                          letterSpacing: 1.5,
                          lineHeight: 1.6,
                        }}
                      >
                        {s.addressLine1}
                      </p>
                      <p
                        style={{
                          margin: "0 0 22px",
                          fontFamily: sigFont,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#000",
                          textTransform: "uppercase",
                          letterSpacing: 1.5,
                          lineHeight: 1.6,
                        }}
                      >
                        {s.addressLine2}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: sigFont,
                          fontSize: 16,
                          fontWeight: 400,
                          color: "#000",
                          lineHeight: 1.2,
                        }}
                      >
                        www.
                        <span style={{ fontWeight: 800, fontSize: 20 }}>
                          chaiiwala
                        </span>
                        .co.uk
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
        )}

        {/* HTML source */}
        {viewMode === "html" && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--grey-200)",
                fontSize: 12,
                color: "var(--grey-500)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Read-only — auto-updates as you edit in Live preview</span>
              <span>{renderedHtml.length} chars</span>
            </div>
            <pre
              style={{
                margin: 0,
                padding: 20,
                background: "#0b1020",
                color: "#e5e7eb",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.6,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 520,
                overflowY: "auto",
              }}
            >
              {renderedHtml || "(empty)"}
            </pre>
          </div>
        )}

        {/* In an email — fake email thread */}
        {viewMode === "thread" && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--grey-200)",
                background: "var(--grey-50)",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--grey-900)",
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
                  color: "var(--grey-700)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--black)",
                    color: "var(--white)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: 13,
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
                  <div
                    style={{
                      color: "var(--grey-900)",
                      fontWeight: 500,
                    }}
                  >
                    {name || "Full Name"}{" "}
                    <span
                      style={{
                        color: "var(--grey-400)",
                        fontWeight: 400,
                      }}
                    >
                      &lt;
                      {selectedId
                        ? senders.find((x) => x.id === selectedId)?.email
                        : "you@chaiiwala.co.uk"}
                      &gt;
                    </span>
                  </div>
                  <div
                    style={{
                      color: "var(--grey-400)",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    to client@example.com · just now
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                padding: "28px 32px",
                background: "var(--white)",
                fontFamily: "'Aptos', 'Segoe UI', Calibri, Arial, sans-serif",
                fontSize: 14,
                color: "var(--grey-900)",
                lineHeight: 1.55,
              }}
            >
              <p style={{ margin: "0 0 14px" }}>Hi Sarah,</p>
              <p style={{ margin: "0 0 14px" }}>
                Just wanted to follow up on the quick question about next
                week's launch — happy to jump on a call tomorrow afternoon if
                that works for you. Let me know what time suits.
              </p>
              <p style={{ margin: "0 0 14px" }}>Thanks,</p>
              <p style={{ margin: "0 0 24px" }}>{name || "Full Name"}</p>
              <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
