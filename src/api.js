import axios from "axios";
import { API_BASE, SESSION_ID } from "./config";

const sessionHeaders = { "x-session-id": SESSION_ID };

// Upload one PDF for this browser session. Resolves on success, rejects with a
// readable message (the server answers 400 with a plain-text reason).
export async function uploadPdf(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    await axios.post(`${API_BASE}/upload`, formData, {
      headers: sessionHeaders,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  } catch (error) {
    const reason = typeof error.response?.data === "string" ? error.response.data : null;
    throw new Error(reason || "Upload failed. Check that the server is running and try again.");
  }
}

export async function resetHistory() {
  await axios.post(`${API_BASE}/reset-chat-history`, null, { headers: sessionHeaders });
}

// Stream one answer over Server-Sent Events. The server sends
// {ragAnswer} (the document answer so far), then {mcpAnswer | mcpError}, then {done}.
// Returns a function that closes the stream.
export function streamChat(question, { onRag, onWeb, onDone, onError }) {
  const url = `${API_BASE}/chat?sessionId=${SESSION_ID}&question=${encodeURIComponent(question)}`;
  const source = new EventSource(url);
  let finished = false;
  const finish = () => {
    finished = true;
    source.close();
  };

  source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.ragAnswer !== undefined) onRag(data.ragAnswer);
    else if (data.mcpAnswer !== undefined) onWeb(data.mcpAnswer, data.mcpError);
    else if (data.done) {
      finish();
      onDone();
    } else if (data.error) {
      finish();
      onError(data.error);
    }
  };
  source.onerror = () => {
    if (finished) return;
    finish();
    onError("Could not reach the server. Upload a PDF first, then ask again.");
  };
  return finish;
}
