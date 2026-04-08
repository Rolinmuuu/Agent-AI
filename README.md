# Agent AI — Full-Stack RAG & MCP-Driven Q&A Agent

A voice-enabled, full-stack AI Q&A application that combines a **RAG (Retrieval-Augmented Generation)** pipeline with a **Model Context Protocol (MCP)** web search server. Upload a PDF, ask questions in text or voice, and receive two parallel answers — one grounded in your document, one from live web search — streamed in real time.

---

## Features

### RAG Pipeline (Document Q&A)
- **PDF ingestion** — drag-and-drop upload via Multer
- **Text splitting** — `RecursiveCharacterTextSplitter` with `chunkSize: 500`, `chunkOverlap: 50`
- **Vector embeddings** — OpenAI `text-embedding-ada-002` via `OpenAIEmbeddings`
- **In-memory vector store** — `MemoryVectorStore` with **per-file caching**: same PDF is embedded only once per server session, subsequent queries skip re-processing
- **Semantic retrieval** — top-k similarity search via LangChain retriever
- **Grounded generation** — GPT-5 answers strictly from retrieved context

### MCP Web Search
- **MCP server** — `@modelcontextprotocol/sdk` over stdio transport
- **`search_web` tool** — SerpAPI Google search, returns top-N results
- **MCP client** — reusable singleton connection with auto-reconnect on error
- **LangChain summarization** — GPT-5 condenses raw search results into a concise answer

### Dual-Channel Parallel Answers
- RAG (document) and MCP (web search) run **concurrently** via `Promise.all`
- Both answers streamed back in the same SSE connection
- Results displayed side by side: blue bubble (document) + green bubble (web)

### Streaming (Server-Sent Events)
- Backend streams RAG answer token-by-token via SSE (`/chat` endpoint)
- Frontend receives chunks with `EventSource`, renders a real-time typewriter effect
- MCP answer appended after RAG stream completes
- `{ done: true }` signal cleanly closes the connection

### Conversation History (Multi-Turn)
- Full chat history maintained server-side using LangChain `HumanMessage` / `AIMessage`
- `ChatPromptTemplate` + `MessagesPlaceholder` injects history into every prompt
- Model understands follow-up questions referencing prior answers
- `POST /reset-chat-history` endpoint to clear history

### Voice Interface
- **Speech-to-Text (STT)** — `react-speech-recognition` (Web Speech API)
- **Text-to-Speech (TTS)** — `speak-tts` reads RAG answers aloud
- **Chat Mode** — continuous voice loop: AI speaks answer → mic auto-activates → user replies

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                    │
│  PdfUploader → ChatComponent (SSE) → RenderQA       │
│  STT (react-speech-recognition) + TTS (speak-tts)  │
└──────────────────────┬──────────────────────────────┘
                       │ GET /chat (SSE)
                       │ POST /upload
┌──────────────────────▼──────────────────────────────┐
│              Express Backend (Node.js)              │
│                                                     │
│  ┌──────────────────┐   ┌────────────────────────┐  │
│  │   RAG Pipeline   │   │     MCP Client         │  │
│  │  chat.js         │   │   chat-mcp.js          │  │
│  │                  │   │                        │  │
│  │ PDFLoader        │   │  StdioClientTransport  │  │
│  │ TextSplitter     │   │  → mcp-server.js       │  │
│  │ OpenAIEmbeddings │   │    └ SerpAPI search    │  │
│  │ MemoryVectorStore│   │  GPT-5 summarization   │  │
│  │ GPT-5 (stream)   │   │                        │  │
│  └──────────────────┘   └────────────────────────┘  │
│          Promise.all([RAG stream, MCP])              │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Ant Design |
| Voice | react-speech-recognition, speak-tts |
| Backend | Node.js, Express, Multer |
| LLM | OpenAI GPT-5 |
| RAG | LangChain (`@langchain/openai`, `@langchain/community`, `@langchain/textsplitters`) |
| MCP | `@modelcontextprotocol/sdk` |
| Web Search | SerpAPI |
| Streaming | Server-Sent Events (SSE) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key
- SerpAPI API key

### Environment Variables

Create a `.env` file inside the `server/` directory:

```
OPENAI_API_KEY=your_openai_api_key
SERPAPI_API_KEY=your_serpapi_api_key
```

### Install & Run

**Backend:**

```bash
cd server
npm install
node server.js
# Server runs on http://localhost:5001
```

**Frontend:**

```bash
# from project root
npm install
npm start
# App runs on http://localhost:3000
```

### Usage

1. Open `http://localhost:3000`
2. Drag and drop a PDF file into the upload area
3. Type a question in the search bar and press Enter
4. Two answers appear in real time:
   - **RAG Answer** (blue) — sourced from your document
   - **MCP Answer** (green) — sourced from live web search
5. Toggle **Chat Mode** to switch to hands-free voice conversation

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload a PDF file |
| `GET` | `/chat?question=...` | SSE stream: RAG + MCP answers |
| `POST` | `/reset-chat-history` | Clear conversation history |

---

## Project Structure

```
├── server/
│   ├── server.js          # Express server, SSE endpoint, chat history
│   ├── chat.js            # RAG pipeline (vectorStore cache + streaming)
│   ├── chat-mcp.js        # MCP client, GPT-5 summarization
│   ├── mcp-server.js      # MCP server with search_web tool (SerpAPI)
│   └── uploads/           # Uploaded PDF files
├── src/
│   ├── App.js             # Root component, streaming state handlers
│   └── components/
│       ├── ChatComponent.js   # EventSource, STT/TTS, Chat Mode
│       ├── PdfUploader.js     # Drag-and-drop PDF upload
│       └── RenderQA.js        # Conversation display (RAG + MCP bubbles)
```
