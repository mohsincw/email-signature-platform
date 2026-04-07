"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface ParsedRow {
  email: string;
  name: string;
  title?: string;
  phone?: string;
  phone2?: string;
  _error?: string;
}

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  email: "email",
  "email address": "email",
  name: "name",
  "full name": "name",
  title: "title",
  "job title": "title",
  position: "title",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  phone2: "phone2",
  "phone 2": "phone2",
  "phone number 2": "phone2",
  landline: "phone2",
};

function detectDelimiter(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.includes(",")) return ",";
  return "\t";
}

function splitLine(line: string, delim: string): string[] {
  // Simple parser that handles quoted values containing the delimiter
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCsvOrTsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const delim = detectDelimiter(lines[0]);
  const headerCells = splitLine(lines[0], delim).map((h) =>
    h.toLowerCase().trim()
  );

  // If the first row doesn't look like headers (no "email" / "name"),
  // assume there are no headers and use a default order.
  const looksLikeHeaders =
    headerCells.includes("email") ||
    headerCells.includes("name") ||
    headerCells.includes("email address");

  let columnMap: Array<keyof ParsedRow | null>;
  let dataLines: string[];

  if (looksLikeHeaders) {
    columnMap = headerCells.map((h) => HEADER_ALIASES[h] ?? null);
    dataLines = lines.slice(1);
  } else {
    columnMap = ["name", "email", "title", "phone", "phone2"];
    dataLines = lines;
  }

  return dataLines.map((line) => {
    const cells = splitLine(line, delim);
    const row: ParsedRow = { email: "", name: "" };
    for (let i = 0; i < cells.length; i++) {
      const field = columnMap[i];
      if (!field) continue;
      (row as any)[field] = cells[i];
    }
    if (!row.email) row._error = "Missing email";
    else if (!row.name) row._error = "Missing name";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
      row._error = "Invalid email";
    return row;
  });
}

export default function ImportSendersPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ created: number; failed: number } | null>(
    null
  );

  const rows = useMemo(() => parseCsvOrTsv(text), [text]);
  const validRows = rows.filter((r) => !r._error);
  const errorCount = rows.length - validRows.length;

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    let created = 0;
    let failed = 0;
    for (const row of validRows) {
      try {
        await api.senders.create({
          email: row.email,
          name: row.name,
          title: row.title || undefined,
          phone: row.phone || undefined,
          phone2: row.phone2 || undefined,
        });
        created++;
      } catch {
        failed++;
      }
    }
    setResults({ created, failed });
    setImporting(false);
    if (failed === 0) {
      setTimeout(() => router.push("/senders"), 800);
    }
  };

  return (
    <div>
      <h2>Bulk Import Senders</h2>
      <p style={{ marginBottom: 24, color: "#737373", fontSize: 14 }}>
        Paste rows from Excel, Google Sheets, or any CSV. The first row should
        be headers (any of: <code>email</code>, <code>name</code>,{" "}
        <code>title</code>, <code>phone</code>, <code>phone2</code>). If you
        skip headers, columns are assumed to be in this order:{" "}
        <code>name, email, title, phone, phone2</code>.
      </p>

      <div className="card">
        <div className="form-group">
          <label>Paste your data here</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={`name\temail\ttitle\tphone\nben robinson\tben@chaiiwala.co.uk\tMarketing Executive\t+44 (0) 7398 840 817\nurvashi meghji\turvashi@chaiiwala.co.uk\tJunior Designer\t+44 (0) 7968 674 201`}
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 13,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              borderRadius: 8,
              border: "1px solid #D4D4D4",
              resize: "vertical",
              boxSizing: "border-box",
              lineHeight: 1.5,
            }}
          />
        </div>

        {rows.length > 0 && (
          <>
            <div
              style={{
                fontSize: 13,
                color: "#525252",
                marginBottom: 12,
                display: "flex",
                gap: 16,
              }}
            >
              <span>
                <strong>{validRows.length}</strong> valid row
                {validRows.length !== 1 ? "s" : ""}
              </span>
              {errorCount > 0 && (
                <span style={{ color: "#DC2626" }}>
                  {errorCount} row{errorCount !== 1 ? "s" : ""} with errors
                </span>
              )}
            </div>

            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Title</th>
                    <th>Phone</th>
                    <th>Phone 2</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      style={{
                        background: r._error ? "#FEF2F2" : undefined,
                      }}
                    >
                      <td>{r.name || "-"}</td>
                      <td>{r.email || "-"}</td>
                      <td>{r.title || "-"}</td>
                      <td>{r.phone || "-"}</td>
                      <td>{r.phone2 || "-"}</td>
                      <td
                        style={{
                          color: r._error ? "#DC2626" : "#16A34A",
                          fontSize: 12,
                        }}
                      >
                        {r._error ?? "OK"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {results && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              background: results.failed === 0 ? "#F0FDF4" : "#FEF2F2",
              color: results.failed === 0 ? "#16A34A" : "#DC2626",
              border: `1px solid ${
                results.failed === 0 ? "#BBF7D0" : "#FECACA"
              }`,
            }}
          >
            Created {results.created} sender{results.created !== 1 ? "s" : ""}
            {results.failed > 0 ? `, ${results.failed} failed` : ""}.
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            onClick={handleImport}
            className="btn btn-primary"
            disabled={importing || validRows.length === 0}
          >
            {importing
              ? `Importing... (${validRows.length})`
              : `Import ${validRows.length} sender${
                  validRows.length !== 1 ? "s" : ""
                }`}
          </button>
          <a href="/senders" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </div>
    </div>
  );
}
