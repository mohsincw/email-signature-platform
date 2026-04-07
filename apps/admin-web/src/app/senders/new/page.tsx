"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function NewSenderPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", name: "", title: "", phone: "", phone2: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.senders.create({
        email: form.email,
        name: form.name,
        title: form.title || undefined,
        phone: form.phone || undefined,
        phone2: form.phone2 || undefined,
      });
      router.push("/senders");
    } catch (err) {
      alert("Failed to create sender");
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Add Sender</h2>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ben.robinson@chaiiwala.co.uk"
            />
          </div>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ben robinson"
            />
          </div>
          <div className="form-group">
            <label>Job Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Marketing Executive"
            />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+44 (0) 7398 840 817"
            />
          </div>
          <div className="form-group">
            <label>Phone Number 2 (optional)</label>
            <input
              type="tel"
              value={form.phone2}
              onChange={(e) => setForm({ ...form, phone2: e.target.value })}
              placeholder="+44 (0) 1162 966 705"
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Sender"}
            </button>
            <a href="/senders" className="btn btn-secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
