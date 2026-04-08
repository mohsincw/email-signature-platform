"use client";

import { Pencil, Users, Settings, LogOut, Activity } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { api } from "@/lib/api";

const navItems = [
  { href: "/generate", label: "editor", icon: Pencil, match: ["/generate"] },
  { href: "/senders", label: "people", icon: Users, match: ["/senders"] },
  { href: "/console", label: "console", icon: Activity, match: ["/console"] },
  { href: "/settings", label: "settings", icon: Settings, match: ["/settings"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.senders
      .list()
      .then((s) => {
        if (!cancelled) setCount(s.length);
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
          <p className="logo-sub">signature manager</p>
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
          <span className="dot ok" />
          <span>
            {count !== null
              ? `${count} ${count === 1 ? "person" : "people"} · live`
              : "loading…"}
          </span>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-user-info">{user?.email ?? ""}</div>
          <button onClick={logout} title="Sign out">
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
