"use client";

import { useEffect, useState, useMemo } from "react";
import { Trash2, Cloud, Copy, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import type { SenderDto } from "@esp/shared-types";
import { api } from "@/lib/api";

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = 60_000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function SendersPage() {
  const [senders, setSenders] = useState<SenderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [outlookConfigured, setOutlookConfigured] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const [deployErrors, setDeployErrors] = useState<
    { name: string; email: string; error: string }[]
  >([]);

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

  const enabledCount = useMemo(
    () => senders.filter((s) => s.enabled).length,
    [senders]
  );

  const toggleEnabled = async (sender: SenderDto) => {
    if (
      sender.enabled &&
      outlookConfigured &&
      !confirm(
        `Disable ${sender.name}?\n\nThis will also turn off their signature in Outlook so it stops appearing on outgoing email. They can be re-enabled and re-deployed later.`
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
      ? `Delete ${sender?.name ?? "this sender"}?\n\nThis will also clear their signature from Outlook. The change is permanent.`
      : "Delete this sender?";
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
      `Email for the new sender (must be unique):`,
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
    if (selected.size === senders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(senders.map((s) => s.id)));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const msg = outlookConfigured
      ? `Delete ${selected.size} sender${selected.size > 1 ? "s" : ""}?\n\nThis will also clear their signatures from Outlook. The change is permanent.`
      : `Delete ${selected.size} sender${selected.size > 1 ? "s" : ""}?`;
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) => api.senders.delete(id))
      );
      setSenders((prev) => prev.filter((s) => !selected.has(s.id)));
      setSelected(new Set());
    } catch {
      alert("Some deletions failed");
    } finally {
      setDeleting(false);
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
          ? `Deployed ${ok} signature${ok !== 1 ? "s" : ""} to Outlook`
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

  const deployAll = () =>
    deployIds(senders.filter((s) => s.enabled).map((s) => s.id));

  const deploySelected = () => deployIds(Array.from(selected));

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div className="top-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2>Senders</h2>
          {selected.size > 0 && (
            <span style={{ fontSize: 13, color: "#64748B" }}>
              {selected.size} selected
            </span>
          )}
        </div>
        <div className="actions">
          {selected.size > 0 && outlookConfigured && (
            <button
              onClick={deploySelected}
              className="btn btn-primary"
              disabled={deploying}
            >
              <Cloud size={16} strokeWidth={2} />
              {deploying ? "Deploying..." : `Deploy Selected (${selected.size})`}
            </button>
          )}
          {selected.size === 0 && outlookConfigured && enabledCount > 0 && (
            <button
              onClick={deployAll}
              className="btn btn-primary"
              disabled={deploying}
              title={`Deploy all ${enabledCount} enabled senders`}
            >
              <Cloud size={16} strokeWidth={2} />
              {deploying ? "Deploying..." : `Deploy All (${enabledCount})`}
            </button>
          )}
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              className="btn btn-danger"
              disabled={deleting}
            >
              <Trash2 size={16} strokeWidth={2} />
              {deleting ? "Deleting..." : `Delete (${selected.size})`}
            </button>
          )}
          <a href="/senders/import" className="btn btn-secondary">
            <Upload size={16} strokeWidth={2} />
            Bulk Import
          </a>
          <a href="/senders/new" className="btn btn-primary">
            Add Sender
          </a>
        </div>
      </div>

      {!outlookConfigured && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            background: "#FFFBEB",
            color: "#92400E",
            border: "1px solid #FCD34D",
          }}
        >
          ⓘ Outlook auto-deploy is not configured. Set{" "}
          <code>AZURE_TENANT_ID</code>, <code>AZURE_CLIENT_ID</code>, and{" "}
          <code>AZURE_CLIENT_SECRET</code> in Vercel to enable one-click
          deployment.
        </div>
      )}

      {deployMessage && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            background: deployMessage.includes("failed") ? "#FEF2F2" : "#F0FDF4",
            color: deployMessage.includes("failed") ? "#DC2626" : "#16A34A",
            border: `1px solid ${
              deployMessage.includes("failed") ? "#FECACA" : "#BBF7D0"
            }`,
          }}
        >
          <div style={{ fontWeight: 600 }}>{deployMessage}</div>
          {deployErrors.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {deployErrors.map((e, i) => (
                <li key={i} style={{ marginTop: 4 }}>
                  <strong>{e.name}</strong> ({e.email}): {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={
                    senders.length > 0 && selected.size === senders.length
                  }
                  onChange={toggleSelectAll}
                  style={{ cursor: "pointer", width: 16, height: 16 }}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Title</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Last Deployed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {senders.map((sender) => (
              <tr
                key={sender.id}
                style={{
                  background: selected.has(sender.id) ? "#F5F5F5" : undefined,
                }}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(sender.id)}
                    onChange={() => toggleSelect(sender.id)}
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                </td>
                <td>{sender.name}</td>
                <td>{sender.email}</td>
                <td>{sender.title ?? "-"}</td>
                <td>{sender.phone ?? "-"}</td>
                <td>
                  <span
                    className={`badge ${
                      sender.enabled ? "badge-active" : "badge-inactive"
                    }`}
                  >
                    {sender.enabled ? "Active" : "Disabled"}
                  </span>
                </td>
                <td
                  style={{
                    fontSize: 12,
                    color:
                      sender.lastDeployedStatus === "failed"
                        ? "#DC2626"
                        : sender.lastDeployedStatus === "success"
                        ? "#16A34A"
                        : "#A3A3A3",
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
                <td className="actions">
                  <a
                    href={`/senders/${sender.id}`}
                    className="btn btn-secondary"
                  >
                    Edit
                  </a>
                  <button
                    onClick={() => duplicateSender(sender)}
                    className="btn btn-secondary"
                    title="Duplicate this sender"
                  >
                    <Copy size={14} strokeWidth={2} />
                  </button>
                  {outlookConfigured && (
                    <button
                      onClick={() => deployIds([sender.id])}
                      className="btn btn-secondary"
                      disabled={deploying}
                      title="Deploy this signature to Outlook"
                    >
                      <Cloud size={14} strokeWidth={2} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleEnabled(sender)}
                    className="btn btn-secondary"
                  >
                    {sender.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => deleteSender(sender.id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {senders.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "#999" }}>
                  No senders yet — click <strong>Add Sender</strong> or{" "}
                  <strong>Bulk Import</strong> to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
