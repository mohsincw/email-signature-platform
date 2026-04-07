"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { SenderDto, GlobalSettingsDto, SignatureRenderInput } from "@esp/shared-types";
import { api } from "@/lib/api";

function SignaturePreviewInner({
  senderName,
  senderTitle,
  senderPhone,
  senderPhone2,
  addressLine1,
  addressLine2,
  website,
  logoUrl,
  badgeUrl,
}: SignatureRenderInput) {
  const font = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  return (
    <div style={{ marginTop: 20 }}>
      <table cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: 20, borderRight: "2px solid #000", width: 140 }}>
              {logoUrl && (
                <img src={logoUrl} alt="chaiiwala" width={130} style={{ display: "block", width: 130, height: "auto" }} />
              )}
              {badgeUrl && (
                <img src={badgeUrl} alt="" width={80} style={{ display: "block", width: 80, height: "auto", marginTop: 8 }} />
              )}
              {!logoUrl && !badgeUrl && (
                <div style={{ width: 130, height: 80, background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#999" }}>
                  no logo set
                </div>
              )}
            </td>
            <td style={{ verticalAlign: "top", paddingLeft: 20 }}>
              <p style={{ margin: "0 0 2px", fontFamily: font, fontSize: 18, fontWeight: 700, color: "#000", lineHeight: 1.2 }}>
                {senderName}
              </p>
              {senderTitle && (
                <p style={{ margin: "0 0 14px", fontFamily: font, fontSize: 11, fontWeight: 600, color: "#000", textTransform: "uppercase", letterSpacing: 2, lineHeight: 1.3 }}>
                  {senderTitle}
                </p>
              )}
              {senderPhone && senderPhone2 && (
                <>
                  <p style={{ margin: 0, fontFamily: font, fontSize: 16, fontWeight: 700, color: "#000", lineHeight: 1.4 }}>
                    {senderPhone}
                  </p>
                  <p style={{ margin: "0 0 14px", fontFamily: font, fontSize: 16, fontWeight: 700, color: "#000", lineHeight: 1.4 }}>
                    {senderPhone2}
                  </p>
                </>
              )}
              {senderPhone && !senderPhone2 && (
                <p style={{ margin: "0 0 14px", fontFamily: font, fontSize: 16, fontWeight: 700, color: "#000", lineHeight: 1.2 }}>
                  {senderPhone}
                </p>
              )}
              {addressLine1 && (
                <p style={{ margin: 0, fontFamily: font, fontSize: 10, fontWeight: 600, color: "#000", textTransform: "uppercase", letterSpacing: 1.5, lineHeight: 1.6 }}>
                  {addressLine1}
                </p>
              )}
              {addressLine2 && (
                <p style={{ margin: "0 0 14px", fontFamily: font, fontSize: 10, fontWeight: 600, color: "#000", textTransform: "uppercase", letterSpacing: 1.5, lineHeight: 1.6 }}>
                  {addressLine2}
                </p>
              )}
              {website && (
                <p style={{ margin: 0, fontFamily: font, fontSize: 14, fontWeight: 700, color: "#000", lineHeight: 1.2 }}>
                  {website}
                </p>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const senderId = searchParams.get("senderId");
  const [senders, setSenders] = useState<SenderDto[]>([]);
  const [settings, setSettings] = useState<GlobalSettingsDto | null>(null);
  const [selectedId, setSelectedId] = useState<string>(senderId ?? "");

  useEffect(() => {
    api.senders.list().then(setSenders);
    api.settings.get().then(setSettings);
  }, []);

  const selectedSender = senders.find((s) => s.id === selectedId);

  return (
    <div>
      <h2>Signature Preview</h2>
      <div className="card">
        <div className="form-group">
          <label>Select Sender</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">-- Choose a sender --</option>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedSender && settings && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Preview</h3>
          <div className="preview-frame">
            <SignaturePreviewInner
              senderName={selectedSender.name}
              senderTitle={selectedSender.title}
              senderPhone={selectedSender.phone}
              senderPhone2={selectedSender.phone2}
              addressLine1={settings.addressLine1}
              addressLine2={settings.addressLine2}
              website={settings.website}
              logoUrl={settings.logoUrl}
              badgeUrl={settings.badgeUrl}
            />
          </div>
        </div>
      )}

      {selectedSender && settings && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Email Preview</h3>
          <div className="preview-frame" style={{ background: "#fff" }}>
            <p style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "#333", marginBottom: 16 }}>
              Hi Team,<br /><br />
              Just following up on the meeting from earlier today. Let me know if you need anything else.<br /><br />
              Thanks,
            </p>
            <SignaturePreviewInner
              senderName={selectedSender.name}
              senderTitle={selectedSender.title}
              senderPhone={selectedSender.phone}
              senderPhone2={selectedSender.phone2}
              addressLine1={settings.addressLine1}
              addressLine2={settings.addressLine2}
              website={settings.website}
              logoUrl={settings.logoUrl}
              badgeUrl={settings.badgeUrl}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <PreviewContent />
    </Suspense>
  );
}
