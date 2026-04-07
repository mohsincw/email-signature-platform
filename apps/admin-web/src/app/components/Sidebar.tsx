"use client";

import { Users, Settings, Eye, LogOut, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

const navItems = [
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/senders", label: "Senders", icon: Users },
  { href: "/settings", label: "Global Settings", icon: Settings },
  { href: "/preview", label: "Preview", icon: Eye },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="logo-area">
        <Link href="/" style={{ textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/chaiiwala-logo-white.png"
            alt="chaiiwala"
            className="logo-img"
          />
          <p className="logo-sub">Signature Manager</p>
        </Link>
      </div>
      <nav>
        <ul className="nav-list">
          {navItems.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={pathname === href || pathname.startsWith(href + "/") ? "active" : ""}
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">
        {user && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.name}
          </p>
        )}
        <div className="sidebar-footer-icons">
          <button title="Settings"><Settings size={16} strokeWidth={2} /></button>
          <button title="Log out" onClick={logout}><LogOut size={16} strokeWidth={2} /></button>
        </div>
      </div>
    </aside>
  );
}
