"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Zap, ShieldCheck, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { api, type MailEventDto } from "@/lib/api";

// Polling interval for the live feed. 2 seconds feels snappy without
// hammering the DB — a typical admin session pulls a few hundred rows
// over 5 minutes which is fine for a cheap indexed query on created_at.
const POLL_MS = 2000;

// Max events held in the client-side list. We append new rows arriving
// via the since-poll and prune the oldest when we exceed this.
const MAX_EVENTS = 200;

interface Stats {
  total: number;
  signed: number;
  passthrough: number;
  already_processed: number;
  error: number;
}

const ZERO_STATS: Stats = {
  total: 0,
  signed: 0,
  passthrough: 0,
  already_processed: 0,
  error: 0,
};

export default function ConsolePage() {
  const [events, setEvents] = useState<MailEventDto[]>([]);
  const [stats, setStats] = useState<Stats>(ZERO_STATS);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const lastSeenRef = useRef<string | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    api.events
      .list({ limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events);
        setStats(res.stats);
        if (res.events.length > 0) {
          lastSeenRef.current = res.events[0].createdAt;
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live poll — only fetch rows newer than the last one we have, so
  // repeat requests are cheap and idempotent.
  useEffect(() => {
    if (!live) return;
    const tick = async () => {
      try {
        const res = await api.events.list({
          since: lastSeenRef.current ?? undefined,
          limit: 50,
        });
        if (res.events.length > 0) {
          lastSeenRef.current = res.events[0].createdAt;
          setEvents((prev) => {
            const merged = [...res.events, ...prev];
            return merged.slice(0, MAX_EVENTS);
          });
        }
        setStats(res.stats);
      } catch {
        // swallow transient errors — next tick retries
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [live]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">console</div>
          <div className="page-subtitle">
            live feed of every email the signature relay sees — refreshes
            every couple of seconds while you watch
          </div>
        </div>
        <button
          className={`btn ${live ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setLive((v) => !v)}
          title={live ? "Pause live updates" : "Resume live updates"}
        >
          <span
            className={`live-dot ${live ? "on" : "off"}`}
            aria-hidden="true"
          />
          {live ? "Live" : "Paused"}
        </button>
      </div>

      <div className="stat-row">
        <StatCard
          label="Emails in the last 24h"
          value={stats.total}
          icon={<Activity size={16} strokeWidth={2} />}
          tone="neutral"
        />
        <StatCard
          label="Signatures beamed in"
          value={stats.signed}
          icon={<ShieldCheck size={16} strokeWidth={2} />}
          tone="ok"
        />
        <StatCard
          label="Passed through (no match)"
          value={stats.passthrough}
          icon={<ArrowRight size={16} strokeWidth={2} />}
          tone="muted"
        />
        <StatCard
          label="Caught by loop guard"
          value={stats.already_processed}
          icon={<RefreshCw size={16} strokeWidth={2} />}
          tone="muted"
        />
        <StatCard
          label="Errors"
          value={stats.error}
          icon={<AlertTriangle size={16} strokeWidth={2} />}
          tone={stats.error > 0 ? "danger" : "muted"}
        />
      </div>

      <div className="feed-card">
        {loading && events.length === 0 ? (
          <div className="feed-empty muted">Tuning in to the relay…</div>
        ) : events.length === 0 ? (
          <div className="feed-empty muted">
            Nothing yet. Send yourself a test email and it&apos;ll pop up here
            within a couple of seconds.
          </div>
        ) : (
          <ul className="feed-list">
            {events.map((ev) => (
              <FeedRow key={ev.id} event={ev} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "neutral" | "ok" | "muted" | "danger";
}) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-value">{value.toLocaleString()}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

/**
 * One row of the live feed. Translates the technical `status` enum
 * into friendly, conversational copy so the page feels like a chat
 * log rather than a server log.
 */
function FeedRow({ event }: { event: MailEventDto }) {
  const { copy, tone, pillLabel } = describeEvent(event);
  return (
    <li className={`feed-row feed-${tone}`}>
      <div className="feed-pill">
        <span className={`pill pill-${tone}`}>{pillLabel}</span>
        <span className="feed-time">{formatTime(event.createdAt)}</span>
      </div>
      <div className="feed-copy">{copy}</div>
      {event.errorMessage && (
        <div className="feed-error">{event.errorMessage}</div>
      )}
    </li>
  );
}

/**
 * Turn a raw MailEvent into friendly UI copy. This is intentionally
 * chatty — the Console is meant to feel like fun office ambience,
 * not a server logfile.
 */
function describeEvent(ev: MailEventDto): {
  copy: React.ReactNode;
  tone: "ok" | "muted" | "info" | "danger";
  pillLabel: string;
} {
  const who = prettifySender(ev);
  const recipients = prettifyRecipients(ev.recipients);

  switch (ev.status) {
    case "signed":
      return {
        pillLabel: "signed",
        tone: "ok",
        copy: (
          <>
            <strong>{who}</strong> sent an email to {recipients} —{" "}
            intercepted, signature stitched on, sent on its way.
          </>
        ),
      };
    case "passthrough": {
      const why =
        ev.reason === "sender not in directory"
          ? "they're not in the people list yet"
          : ev.reason === "no From header"
            ? "the message had no From header"
            : ev.reason || "nothing to add";
      return {
        pillLabel: "passed through",
        tone: "muted",
        copy: (
          <>
            <strong>{who}</strong> emailed {recipients} — let it through as-is
            ({why}).
          </>
        ),
      };
    }
    case "already_processed":
      return {
        pillLabel: "loop guard",
        tone: "info",
        copy: (
          <>
            <strong>{who}</strong> → {recipients} was already stamped by us.
            Relayed without touching it so Exchange doesn&apos;t bounce it
            back.
          </>
        ),
      };
    case "error":
      return {
        pillLabel: "oops",
        tone: "danger",
        copy: (
          <>
            Something went wrong processing an email from <strong>{who}</strong>{" "}
            to {recipients}. The relay still forwarded it, we just
            couldn&apos;t touch the signature.
          </>
        ),
      };
    default:
      return {
        pillLabel: ev.status,
        tone: "muted",
        copy: (
          <>
            <strong>{who}</strong> → {recipients}
          </>
        ),
      };
  }
}

function prettifySender(ev: MailEventDto): string {
  if (ev.senderName && ev.senderName.trim().length > 0) {
    return ev.senderName;
  }
  // Fallback: just the local-part of the email, so
  // "mohsin@chaiiwala.co.uk" becomes "mohsin" — friendlier than the
  // full address.
  const local = ev.senderEmail.split("@")[0];
  return local || ev.senderEmail;
}

function prettifyRecipients(rcpts: string[]): string {
  if (!rcpts || rcpts.length === 0) return "(no recipients)";
  if (rcpts.length === 1) return rcpts[0];
  if (rcpts.length === 2) return `${rcpts[0]} and ${rcpts[1]}`;
  return `${rcpts[0]} and ${rcpts.length - 1} others`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
