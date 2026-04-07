"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MoreHorizontal,
  Cloud,
  Trash2,
  Copy,
  Pencil,
  Power,
  Upload,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import type { SenderDto } from "@esp/shared-types";
import { api } from "@/lib/api";

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = 60_000,
    hour = 60 * min,
    day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function PeoplePage() {
  const [senders, setSenders] = useState<SenderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outlookConfigured, setOutlookConfigured] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const [deployErrors, setDeployErrors] = useState<
    { name: string; email: string; error: string }[]
  >([]);
  const [openKebab, setOpenKebab] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = () =>
    api.senders.list().then((data) => {
      setSenders(data);
      setLoading(false);
    });

  useEffect(() => {
    refresh();
    api.outlook
      .getStatus()
      .then((s) => setOutlookConfigured(s.configured))
      .catch(() => {});
  }, []);

  // Close kebab menu when clicking outside
  useEffect(() => {
    if (!openKebab) return;
    const onClick = () => setOpenKebab(null);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [openKebab]);

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

  const toggleEnabled = async (sender: SenderDto) => {
    if (
      sender.enabled &&
      outlookConfigured &&
      !confirm(
        `Disable ${sender.name}?\n\nThis will also turn off their signature in Outlook.`
      )
    ) {
      return;
    }
    const updated = await api.senders.update(sender.id, {
      enabled: !sender.enabled,
    });
    setSenders((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const deleteSender = async (id: string) => {
    const sender = senders.find((s) => s.id === id);
    const msg = outlookConfigured
      ? `Delete ${sender?.name}?\n\nThis will also clear their signature from Outlook. Permanent.`
      : `Delete ${sender?.name}?`;
    if (!confirm(msg)) return;
    await api.senders.delete(id);
    setSenders((prev) => prev.filter((s) => s.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const duplicateSender = async (sender: SenderDto) => {
    const newEmail = prompt(
      `Email for the duplicated sender:`,
      sender.email
    );
    if (!newEmail || newEmail === sender.email) return;
    try {
      const created = await api.senders.create({
        email: newEmail.trim(),
        name: sender.name,
        title: sender.title ?? undefined,
        phone: sender.phone ?? undefined,
        phone2: sender.phone2 ?? undefined,
      });
      setSenders((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (err: any) {
      alert(`Failed to duplicate: ${err.message}`);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredSenders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSenders.map((s) => s.id)));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const msg = outlookConfigured
      ? `Delete ${selected.size} ${selected.size > 1 ? "people" : "person"}?\n\nThis will also clear their signatures from Outlook. Permanent.`
      : `Delete ${selected.size} ${selected.size > 1 ? "people" : "person"}?`;
    if (!confirm(msg)) return;
    try {
      await Promise.all(
        Array.from(selected).map((id) => api.senders.delete(id))
      );
      setSenders((prev) => prev.filter((s) => !selected.has(s.id)));
      setSelected(new Set());
    } catch {
      alert("Some deletions failed");
    }
  };

  const deployIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    setDeploying(true);
    setDeployMessage(null);
    setDeployErrors([]);
    try {
      const results = await api.outlook.deploy(ids);
      const ok = results.filter((r) => r.success).length;
      const failures = results.filter((r) => !r.success);
      setDeployMessage(
        failures.length === 0
          ? `Deployed ${ok} ${ok !== 1 ? "signatures" : "signature"} to Outlook`
          : `${ok} deployed, ${failures.length} failed`
      );
      setDeployErrors(
        failures.map((r) => ({
          name: r.senderName,
          email: r.senderEmail,
          error: r.error ?? "Unknown error",
        }))
      );
      await refresh();
    } catch (err: any) {
      setDeployMessage(`Deploy failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const deploySelected = () => deployIds(Array.from(selected));

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">People</div>
          <div className="page-subtitle">
            {senders.length} {senders.length === 1 ? "person" : "people"} in your
            organisation
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/senders/import" className="btn btn-secondary">
            <Upload size={14} />
            Bulk import
          </Link>
          <Link href="/senders/new" className="btn btn-primary">
            <Plus size={14} />
            Add person
          </Link>
        </div>
      </div>

      {!outlookConfigured && (
        <div className="banner banner-warning">
          <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            Outlook auto-deploy isn&apos;t configured. Set the{" "}
            <code>AZURE_*</code> environment variables in Vercel to enable
            one-click deployment from this page.
          </div>
        </div>
      )}

      {deployMessage && (
        <div
          className={`banner ${deployMessage.includes("failed") ? "banner-danger" : "banner-success"}`}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{deployMessage}</div>
            {deployErrors.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {deployErrors.map((e, i) => (
                  <li key={i} style={{ marginTop: 4, fontSize: 12 }}>
                    <strong>{e.name}</strong> ({e.email}): {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or title…"
          style={{
            width: "100%",
            padding: "9px 14px",
            fontSize: 13,
            border: "1px solid var(--grey-200)",
            borderRadius: 8,
            background: "var(--white)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={
                    filteredSenders.length > 0 &&
                    selected.size === filteredSenders.length
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Last deployed</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredSenders.map((sender) => (
              <tr
                key={sender.id}
                style={{
                  background: selected.has(sender.id)
                    ? "var(--grey-50)"
                    : undefined,
                }}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(sender.id)}
                    onChange={() => toggleSelect(sender.id)}
                  />
                </td>
                <td>
                  <div style={{ fontWeight: 500, color: "var(--grey-900)" }}>
                    {sender.name}
                  </div>
                  {sender.title && (
                    <div style={{ fontSize: 12, color: "var(--grey-500)" }}>
                      {sender.title}
                    </div>
                  )}
                </td>
                <td style={{ color: "var(--grey-600)" }}>{sender.email}</td>
                <td>
                  <span
                    className={`badge ${sender.enabled ? "badge-active" : "badge-inactive"}`}
                  >
                    {sender.enabled ? "Active" : "Disabled"}
                  </span>
                </td>
                <td
                  style={{
                    fontSize: 12,
                    color:
                      sender.lastDeployedStatus === "failed"
                        ? "var(--danger)"
                        : sender.lastDeployedStatus === "success"
                        ? "var(--success)"
                        : "var(--grey-500)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {sender.lastDeployedStatus === "success" && (
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                    )}
                    {sender.lastDeployedStatus === "failed" && (
                      <AlertCircle size={12} strokeWidth={2.5} />
                    )}
                    {relativeTime(sender.lastDeployedAt)}
                  </span>
                </td>
                <td>
                  <div className="kebab" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="kebab-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenKebab(
                          openKebab === sender.id ? null : sender.id
                        );
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openKebab === sender.id && (
                      <div className="kebab-menu">
                        <Link
                          href={`/senders/${sender.id}`}
                          className="kebab-item"
                        >
                          <Pencil size={13} />
                          Edit
                        </Link>
                        <button
                          className="kebab-item"
                          onClick={() => {
                            setOpenKebab(null);
                            duplicateSender(sender);
                          }}
                        >
                          <Copy size={13} />
                          Duplicate
                        </button>
                        {outlookConfigured && (
                          <button
                            className="kebab-item"
                            onClick={() => {
                              setOpenKebab(null);
                              deployIds([sender.id]);
                            }}
                          >
                            <Cloud size={13} />
                            Deploy to Outlook
                          </button>
                        )}
                        <button
                          className="kebab-item"
                          onClick={() => {
                            setOpenKebab(null);
                            toggleEnabled(sender);
                          }}
                        >
                          <Power size={13} />
                          {sender.enabled ? "Disable" : "Enable"}
                        </button>
                        <div className="kebab-divider" />
                        <button
                          className="kebab-item danger"
                          onClick={() => {
                            setOpenKebab(null);
                            deleteSender(sender.id);
                          }}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredSenders.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 40 }}>
                  <p className="muted" style={{ marginBottom: 16 }}>
                    {search
                      ? "No people match your search."
                      : "No people yet."}
                  </p>
                  {!search && (
                    <div
                      style={{
                        display: "inline-flex",
                        gap: 8,
                      }}
                    >
                      <Link
                        href="/senders/new"
                        className="btn btn-primary btn-sm"
                      >
                        <Plus size={13} />
                        Add person
                      </Link>
                      <Link
                        href="/senders/import"
                        className="btn btn-secondary btn-sm"
                      >
                        <Upload size={13} />
                        Bulk import
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="action-bar">
          <span className="count">
            {selected.size} selected
          </span>
          <span className="divider" />
          {outlookConfigured && (
            <button onClick={deploySelected} disabled={deploying}>
              <Cloud size={14} />
              {deploying ? "Deploying…" : "Deploy"}
            </button>
          )}
          <button onClick={deleteSelected} className="danger">
            <Trash2 size={14} />
            Delete
          </button>
          <span className="divider" />
          <button onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
    </div>
  );
}
