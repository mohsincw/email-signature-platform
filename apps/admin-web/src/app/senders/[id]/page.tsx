"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, CheckCircle, AlertCircle, Cloud } from "lucide-react";
import type { SenderDto } from "@esp/shared-types";
import { api } from "@/lib/api";

export default function EditSenderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sender, setSender] = useState<SenderDto | null>(null);
  const [form, setForm] = useState({ email: "", name: "", title: "", phone: "", phone2: "" });
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [outlookConfigured, setOutlookConfigured] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null);
  const [lastDeployed, setLastDeployed] = useState<string | null>(null);

  useEffect(() => {
    api.senders.get(id).then((s) => {
      setSender(s);
      setForm({
        email: s.email,
        name: s.name,
        title: s.title ?? "",
        phone: s.phone ?? "",
        phone2: s.phone2 ?? "",
      });
    });
    api.outlook.getStatus().then((s) => setOutlookConfigured(s.configured)).catch(() => {});
    api.outlook.getHistory(id).then((logs) => {
      const last = logs.find((l) => l.status === "success");
      if (last) setLastDeployed(last.deployedAt);
    }).catch(() => {});
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.senders.update(id, {
        email: form.email,
        name: form.name,
        title: form.title || undefined,
        phone: form.phone || undefined,
        phone2: form.phone2 || undefined,
      });
      router.push("/senders");
    } catch {
      alert("Failed to update sender");
      setSaving(false);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    try {
      const { uploadUrl, key } = await api.senders.getUploadUrl(id);
      // TODO: Actually upload the file to the presigned URL
      // await fetch(uploadUrl, { method: "PUT", body: imageFile });
      await api.senders.update(id, { imageKey: key });
      alert("Image key saved. Actual S3 upload is a TODO.");
      const updated = await api.senders.get(id);
      setSender(updated);
    } catch {
      alert("Upload failed");
    }
  };

  if (!sender) return <p>Loading...</p>;

  return (
    <div>
      <h2>Edit Sender</h2>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Job Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Phone Number 2 (optional)</label>
            <input
              type="tel"
              value={form.phone2}
              onChange={(e) => setForm({ ...form, phone2: e.target.value })}
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <a href="/senders" className="btn btn-secondary">
              Cancel
            </a>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Signature Image</h3>
        {sender.imageUrl && (
          <div style={{ marginBottom: 12 }}>
            <img
              src={sender.imageUrl}
              alt="Current signature"
              style={{ maxWidth: 300 }}
            />
          </div>
        )}
        <div className="form-group">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleImageUpload}
          disabled={!imageFile}
        >
          Upload Image
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Send Test Email</h3>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>
          Send a real email with this sender's signature to test rendering in Outlook, Gmail, etc.
        </p>
        <div className="form-group">
          <label>Recipient Email</label>
          <input
            type="email"
            placeholder="you@chaiiwala.co.uk"
            value={testEmail}
            onChange={(e) => { setTestEmail(e.target.value); setTestResult(null); }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (!testEmail) return;
            setSendingTest(true);
            setTestResult(null);
            try {
              const result = await api.senders.sendTestEmail(id, testEmail);
              setTestResult(result);
            } catch (err: any) {
              setTestResult({ success: false, message: err.message });
            } finally {
              setSendingTest(false);
            }
          }}
          disabled={sendingTest || !testEmail}
          style={{ width: "100%" }}
        >
          <Send size={16} strokeWidth={2} />
          {sendingTest ? "Sending..." : "Send Test Email"}
        </button>
        {testResult && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              background: testResult.success ? "#F0FDF4" : "#FEF2F2",
              color: testResult.success ? "#16A34A" : "#DC2626",
              border: `1px solid ${testResult.success ? "#BBF7D0" : "#FECACA"}`,
            }}
          >
            {testResult.success ? (
              <CheckCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            ) : (
              <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {outlookConfigured && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Deploy to Outlook</h3>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>
            Push this sender&apos;s signature directly to their M365/Outlook mailbox.
            {lastDeployed && (
              <span style={{ display: "block", marginTop: 4 }}>
                Last deployed: {new Date(lastDeployed).toLocaleString()}
              </span>
            )}
          </p>
          <button
            className="btn btn-primary"
            onClick={async () => {
              setDeploying(true);
              setDeployResult(null);
              try {
                const results = await api.outlook.deploy([id]);
                const r = results[0];
                setDeployResult({
                  success: r.success,
                  message: r.success
                    ? `Signature deployed to ${r.senderEmail}`
                    : r.error || "Deployment failed",
                });
                if (r.success) setLastDeployed(r.deployedAt);
              } catch (err: any) {
                setDeployResult({ success: false, message: err.message });
              } finally {
                setDeploying(false);
              }
            }}
            disabled={deploying}
            style={{ width: "100%" }}
          >
            <Cloud size={16} strokeWidth={2} />
            {deploying ? "Deploying..." : "Deploy to Outlook"}
          </button>
          {deployResult && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                background: deployResult.success ? "#F0FDF4" : "#FEF2F2",
                color: deployResult.success ? "#16A34A" : "#DC2626",
                border: `1px solid ${deployResult.success ? "#BBF7D0" : "#FECACA"}`,
              }}
            >
              {deployResult.success ? (
                <CheckCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              ) : (
                <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              )}
              <span>{deployResult.message}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <a href={`/preview?senderId=${id}`} className="btn btn-secondary">
          Preview Signature
        </a>
      </div>
    </div>
  );
}
