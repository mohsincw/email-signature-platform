"use client";

import { Pencil, Users, Settings, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { api } from "@/lib/api";

const navItems = [
  { href: "/generate", label: "Editor", icon: Pencil, match: ["/generate"] },
  { href: "/senders", label: "People", icon: Users, match: ["/senders"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

interface StatusInfo {
  label: string;
  state: "ok" | "warn" | "off";
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<StatusInfo>({
    label: "Loading…",
    state: "off",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.outlook.getStatus().catch(() => ({ configured: false })),
      api.admin.serverSideStatus().catch(() => null),
      api.senders.list().catch(() => []),
    ])
      .then(([outlook, srv, senders]) => {
        if (cancelled) return;
        const total = (senders ?? []).length;
        if (srv?.enabled) {
          setStatus({ label: `Live · ${total} people`, state: "ok" });
        } else if (outlook?.configured) {
          setStatus({ label: `${total} people · idle`, state: "warn" });
        } else {
          setStatus({ label: "Setup needed", state: "off" });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <aside className="sidebar">
      <div className="logo-area">
        <Link href="/generate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/chaiiwala-logo-white.png" alt="chaiiwala" className="logo-img" />
          <p className="logo-sub">Signature Manager</p>
        </Link>
      </div>

      <nav>
        <ul className="nav-list">
          {navItems.map(({ href, label, icon: Icon, match }) => {
            const active = match.some(
              (m) => pathname === m || pathname.startsWith(m + "/")
            );
            return (
              <li key={href}>
                <Link href={href} className={active ? "active" : ""}>
                  <Icon size={16} strokeWidth={2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className={`dot ${status.state}`} />
          <span>{status.label}</span>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-user-info">{user?.email ?? "Loading…"}</div>
          <button onClick={logout} title="Sign out">
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
