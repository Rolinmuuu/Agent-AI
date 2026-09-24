// Backend URL can be overridden at build time: REACT_APP_API_BASE=https://... npm run build
export const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

// One id per browser tab. The backend keys the uploaded PDF and the chat
// history by this id, so different users / tabs never share a conversation.
const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

export const SESSION_ID = makeId();
