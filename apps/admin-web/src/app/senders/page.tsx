"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MoreHorizontal,
  Trash2,
  Copy,
  Pencil,
  Power,
  Upload,
  Plus,
} from "lucide-react";
import Link from "next/link";
import type { SenderDto } from "@esp/shared-types";
import { api } from "@/lib/api";

export default function PeoplePage() {
  const [senders, setSenders] = useState<SenderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openKebab, setOpenKebab] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = () =>
    api.senders.list().then((data) => {
      setSenders(data);
      setLoading(false);
    });

  useEffect(() => {
    refresh();
  }, []);

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
    const updated = await api.senders.update(sender.id, {
      enabled: !sender.enabled,
    });
    setSenders((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const deleteSender = async (id: string) => {
    const sender = senders.find((s) => s.id === id);
    if (
      !confirm(
        `Delete ${sender?.name}?\n\nTheir future emails will go out without a signature. Existing sent emails are unaffected.`
      )
    )
      return;
    await api.senders.delete(id);
    setSenders((prev) => prev.filter((s) => s.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const duplicateSender = async (sender: SenderDto) => {
    const newEmail = prompt(`Email for the duplicated sender:`, sender.email);
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
    if (
      !confirm(
        `Delete ${selected.size} ${selected.size > 1 ? "people" : "person"}?\n\nTheir future emails will go out without a signature.`
      )
    )
      return;
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
          <div className="page-title">people</div>
          <div className="page-subtitle">
            {senders.length} {senders.length === 1 ? "person" : "people"} —
            their signature is auto-applied to every outbound email
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
            border: "1px solid var(--karak-beige-200)",
            borderRadius: 10,
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
              <th>Phone</th>
              <th>Status</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredSenders.map((sender) => (
              <tr
                key={sender.id}
                style={{
                  background: selected.has(sender.id)
                    ? "var(--chaii-brown-50)"
                    : undefined,
                  opacity: sender.enabled ? 1 : 0.55,
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
                  <div
                    style={{
                      fontWeight: 500,
                      color: "var(--grey-900)",
                      textTransform: "lowercase",
                    }}
                  >
                    {sender.name}
                  </div>
                  {sender.title && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--grey-500)",
                        textTransform: "lowercase",
                      }}
                    >
                      {sender.title}
                    </div>
                  )}
                </td>
                <td style={{ color: "var(--grey-600)" }}>{sender.email}</td>
                <td style={{ color: "var(--grey-600)", fontSize: 13 }}>
                  {sender.phone ?? "—"}
                </td>
                <td>
                  <span
                    className={`badge ${sender.enabled ? "badge-active" : "badge-inactive"}`}
                  >
                    {sender.enabled ? "active" : "disabled"}
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
          <span className="count">{selected.size} selected</span>
          <span className="divider" />
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
