"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "./AuthProvider";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <AuthProvider>
      {isLoginPage ? (
        // Login page — no sidebar, full screen
        children
      ) : (
        // Authenticated pages — sidebar + main content
        <div className="app-container">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      )}
    </AuthProvider>
  );
}
