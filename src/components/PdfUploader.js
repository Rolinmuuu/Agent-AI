import React, { useRef, useState } from "react";
import { IconUpload, IconDoc, IconCheck, IconAlert } from "./Icons";

const MAX_MB = 20; // mirrors the server's upload limit

export const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Drag-and-drop zone. `onFile` receives a validated PDF File.
export const Dropzone = ({ onFile, compact = false, disabled = false }) => {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [hint, setHint] = useState(null);

  const accept = (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) return setHint("Only PDF files are supported.");
    if (file.size > MAX_MB * 1024 * 1024) return setHint(`That file is over ${MAX_MB} MB.`);
    setHint(null);
    onFile(file);
  };

  return (
    <div
      className={`dropzone${compact ? " compact" : ""}${over ? " over" : ""}${disabled ? " disabled" : ""}`}
      role="button"
      tabIndex={0}
      aria-label="Upload a PDF"
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) accept(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <span className="dz-icon">
        <IconUpload width={compact ? 18 : 22} height={compact ? 18 : 22} />
      </span>
      <div className="dz-text">
        <strong>{compact ? "Replace PDF" : "Drop a PDF here, or click to browse"}</strong>
        {!compact && <span>One file per session · up to {MAX_MB} MB</span>}
      </div>
      {hint && <div className="dz-hint">{hint}</div>}
    </div>
  );
};

// The current document and its indexing state.
export const DocCard = ({ doc }) => {
  if (!doc) return null;
  const { name, size, status, progress, error } = doc;
  return (
    <div className={`doc-card is-${status}`}>
      <span className="doc-icon">
        <IconDoc />
      </span>
      <div className="doc-meta">
        <div className="doc-name" title={name}>
          {name}
        </div>
        <div className="doc-status">
          {status === "uploading" && (
            <>
              <span className="spinner" /> {progress < 100 ? `Uploading ${progress}%` : "Indexing…"}
            </>
          )}
          {status === "ready" && (
            <>
              <IconCheck width={14} height={14} /> Ready · {formatSize(size)}
            </>
          )}
          {status === "error" && (
            <>
              <IconAlert width={14} height={14} /> {error}
            </>
          )}
        </div>
        {status === "uploading" && (
          <div className="doc-progress">
            <span style={{ width: `${Math.max(progress, 8)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dropzone;
