"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { uploadImage } from "@/lib/api";

interface Props {
  label: string;
  helpText?: string;
  value: string;
  kind: "logo" | "badge" | "sender" | "asset";
  onChange: (publicUrl: string) => void;
}

/**
 * A drop / paste / click target that uploads an image to Supabase
 * Storage and stores the resulting public URL in the parent form state.
 *
 * Supports:
 *   - Clicking to open the file picker
 *   - Drag-and-drop a file
 *   - Pasting an image from the clipboard (focus the box first)
 */
export function ImageDropZone({ label, helpText, value, kind, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = async (file: File | Blob) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, kind);
      onChange(url);
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }
    void upload(file);
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleFile(file);
          return;
        }
      }
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      <div
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#000" : "#D4D4D4"}`,
          borderRadius: 8,
          padding: 16,
          minHeight: 120,
          display: "flex",
          alignItems: "center",
          gap: 16,
          cursor: "pointer",
          background: dragging ? "#FAFAFA" : "#fff",
          outline: "none",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={label}
            style={{
              maxWidth: 140,
              maxHeight: 100,
              objectFit: "contain",
              background: "#F5F5F5",
              padding: 4,
              borderRadius: 4,
            }}
          />
        ) : (
          <div
            style={{
              width: 140,
              height: 100,
              background: "#F5F5F5",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#A3A3A3",
              fontSize: 12,
            }}
          >
            no image
          </div>
        )}
        <div style={{ flex: 1, fontSize: 13, color: "#525252" }}>
          {uploading ? (
            <strong>Uploading…</strong>
          ) : (
            <>
              <strong>Click, drop, or paste</strong> an image here.
              <br />
              <span style={{ color: "#999" }}>
                Tip: copy an image to your clipboard then click here and press
                Cmd/Ctrl + V.
              </span>
            </>
          )}
          {error && (
            <div style={{ color: "#DC2626", marginTop: 6, fontSize: 12 }}>
              {error}
            </div>
          )}
          {value && !uploading && (
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                style={{ fontSize: 12 }}
              >
                Remove image
              </button>
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {helpText && (
        <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>{helpText}</p>
      )}
    </div>
  );
}
