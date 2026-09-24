# Agent AI — PDF Q&A with RAG, streaming and MCP web search

A full-stack document Q&A app. Upload a PDF, ask questions by text or voice, and get
two answers: one grounded in your document (RAG, streamed token by token) and one
from live web search through a Model Context Protocol (MCP) tool server.

## Features

**Document answers (RAG)**
- PDF upload (drag and drop), split with `RecursiveCharacterTextSplitter` (500 / 50 overlap)
- OpenAI embeddings (`text-embedding-3-small` by default) in an in-memory vector store,
  cached per uploaded file with an LRU limit, top-6 retrieval
- Answers constrained to the retrieved context and streamed over Server-Sent Events
- Multi-turn: the session's chat history is injected into every prompt (last 20 exchanges)

**Web answers (MCP)**
- `mcp-server.js` exposes a `search_web` tool (SerpAPI) over stdio
- `chat-mcp.js` keeps one MCP client connection, waits for the handshake before calling
  the tool, and reconnects after errors; results are summarised by a chat model
- Runs concurrently with the document answer. If web search fails (no key, network,
  quota), the document answer still completes and the UI shows "Web search unavailable"

**Sessions and uploads**
- Every browser tab gets its own session id; uploaded file and chat history are stored
  per session, so users never see each other's document or conversation
- Uploads are PDF-only, max 20 MB, stored under a random server-side name
- Idle sessions expire after 1 hour and their uploaded files are deleted

**Voice**
- Speech-to-text (`react-speech-recognition`) and text-to-speech (`speak-tts`);
  "Chat Mode" reads the answer aloud and reopens the microphone. Requires a browser with
  the Web Speech API (Chrome).

## Architecture

```
React (Ant Design)                         Express
┌──────────────────────────────┐           ┌───────────────────────────────────────────┐
│ PdfUploader ── POST /upload ─┼──────────►│ session store (per tab id)                │
│ ChatComponent ─ GET /chat SSE┼──────────►│  ├─ chat.js      PDF → chunks → embeddings │
│ RenderQA  (document + web)   │◄──────────┼  │               → retrieve → stream       │
│ STT / TTS                    │  events   │  └─ chat-mcp.js  MCP client ─► mcp-server │
└──────────────────────────────┘           │                  (search_web / SerpAPI)   │
                                           └───────────────────────────────────────────┘
SSE events: {ragAnswer} … {ragAnswer} → {mcpAnswer | mcpError} → {done}   or {error}
```

## Getting started

Requirements: Node.js 18+, an OpenAI API key, and (optional) a SerpAPI key for web answers.

```bash
# server/.env
OPENAI_API_KEY=...
SERPAPI_API_KEY=...          # optional; without it only document answers are returned
# optional overrides: CHAT_MODEL, EMBEDDING_MODEL, SUMMARY_MODEL, PORT (default 5001)
```

```bash
cd server && npm ci && npm start      # http://localhost:5001
npm ci && npm start                   # http://localhost:3000 (from the project root)
```

Set `REACT_APP_API_BASE` when building the frontend for a different backend URL.

## Tests

```bash
cd server && npm test     # HTTP layer with fake RAG/MCP functions — no API keys needed
CI=true npm test          # frontend rendering tests
```

The server tests cover session isolation, per-session history, upload validation,
reset, history trimming / session expiry, and a failing web search not breaking the
document answer.

## API

| Method | Endpoint | Notes |
|---|---|---|
| `POST` | `/upload` | multipart `file`; header `x-session-id` |
| `GET` | `/chat?sessionId=…&question=…` | SSE stream (EventSource cannot send headers) |
| `POST` | `/reset-chat-history` | header `x-session-id` |

## Project structure

```
server/
  server.js      entry point (reads .env, starts the app)
  app.js         routes, uploads, SSE streaming; RAG / MCP functions injected for testing
  sessions.js    per-session file + history, trimming and expiry
  chat.js        RAG pipeline and vector-store cache
  chat-mcp.js    MCP client + summarisation
  mcp-server.js  MCP server exposing search_web
  test/          node:test suite
src/
  config.js      API base URL and per-tab session id
  components/    PdfUploader, ChatComponent (SSE, voice), RenderQA
```

## Limitations

- The vector store and sessions live in memory: a server restart clears them, and the
  app runs as a single process. A persistent vector database and shared session store
  would be the next step for multi-instance deployment.
- There is no user authentication; the session id separates browser tabs, not accounts.
