"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Invalid email or password");
      }

      const { token, user } = await res.json();
      localStorage.setItem("esp_token", token);
      localStorage.setItem("esp_user", JSON.stringify(user));
      window.location.href = "/generate";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        background: "#fff",
      }}
    >
      <div
        style={{
          width: 448,
          padding: 40,
          borderRadius: 16,
          border: "1px solid #E5E5E5",
          background: "#fff",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/chaiiwala-logo-white.png"
            alt="chaiiwala"
            style={{ width: 209, height: "auto", display: "inline-block", filter: "invert(1)" }}
          />
          <p
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: "#64748B",
              marginTop: 6,
            }}
          >
            Signature Manager
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              Email address
            </label>
            <input
              type="email"
              placeholder="you@chaiiwala.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 16px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid #D4D4D4",
                fontFamily: "'Inter', sans-serif",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#000";
                e.target.style.boxShadow = "0 0 0 1px #000";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#D4D4D4";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 44px 10px 16px",
                  fontSize: 14,
                  borderRadius: 8,
                  border: "1px solid #D4D4D4",
                  fontFamily: "'Inter', sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#000";
                  e.target.style.boxShadow = "0 0 0 1px #000";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#D4D4D4";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: "#737373",
                  fontSize: 13,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                background: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FECACA",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 0",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.15s",
              height: 40,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      <p
        style={{
          marginTop: 24,
          fontSize: 13,
          color: "#A3A3A3",
        }}
      >
        &copy; 2026 chaiiwala. All rights reserved.
      </p>
    </div>
  );
}
