// Per-browser-session state: uploaded file + chat history.
// Previously a single module-level `filePath` / `chatHistory` was shared by every
// request, so two users (or two tabs) would read each other's document and history.

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const isValidSessionId = (id) =>
  typeof id === "string" && SESSION_ID_PATTERN.test(id);

export const createSessionStore = ({
  ttlMs = 60 * 60 * 1000,
  maxExchanges = 20,
  now = () => Date.now(),
  onExpire = () => {},
} = {}) => {
  const sessions = new Map();

  const sweep = () => {
    const t = now();
    for (const [id, session] of sessions) {
      if (t - session.lastSeen > ttlMs) {
        sessions.delete(id);
        onExpire(session);
      }
    }
  };

  // Returns the session for a valid id (creating it if needed), or null.
  const get = (id) => {
    if (!isValidSessionId(id)) return null;
    sweep();
    let session = sessions.get(id);
    if (!session) {
      session = { id, filePath: null, chatHistory: [], lastSeen: now() };
      sessions.set(id, session);
    }
    session.lastSeen = now();
    return session;
  };

  const setFile = (session, filePath) => {
    const previous = session.filePath;
    session.filePath = filePath;
    session.chatHistory = []; // a new document starts a new conversation
    return previous;
  };

  // Keep only the most recent `maxExchanges` question/answer pairs so the
  // prompt cannot grow without bound.
  const appendExchange = (session, humanMessage, aiMessage) => {
    session.chatHistory.push(humanMessage, aiMessage);
    const limit = maxExchanges * 2;
    if (session.chatHistory.length > limit) {
      session.chatHistory.splice(0, session.chatHistory.length - limit);
    }
  };

  const reset = (session) => {
    session.chatHistory = [];
  };

  return { get, setFile, appendExchange, reset, sweep, size: () => sessions.size };
};
