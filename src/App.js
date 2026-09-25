import React, { useEffect, useRef, useState } from "react";
import { message } from "antd";
import "./App.css";
import { Dropzone, DocCard } from "./components/PdfUploader";
import RenderQA from "./components/RenderQA";
import ChatComponent from "./components/ChatComponent";
import { IconBolt, IconGlobe, IconLock, IconPlus, IconSpark } from "./components/Icons";
import { resetHistory, streamChat, uploadPdf } from "./api";

const SUGGESTIONS = [
  "Summarise this document in five bullet points",
  "What are the key numbers or dates mentioned?",
  "List any action items or open questions",
];

const FEATURES = [
  { icon: IconBolt, title: "Streams as it answers", text: "Answers arrive token by token over Server-Sent Events." },
  { icon: IconGlobe, title: "Checks the web too", text: "An MCP search tool runs in parallel and answers separately." },
  { icon: IconLock, title: "Private to this tab", text: "Files and history are isolated per session and expire when idle." },
];

const App = () => {
  const [doc, setDoc] = useState(null); // {name, size, status, progress, error}
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [answerVersion, setAnswerVersion] = useState(0);
  const closeStream = useRef(null);
  const scroller = useRef(null);

  useEffect(() => () => closeStream.current && closeStream.current(), []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation]);

  const ready = doc?.status === "ready";

  const handleFile = async (file) => {
    setDoc({ name: file.name, size: file.size, status: "uploading", progress: 0 });
    try {
      await uploadPdf(file, (progress) => setDoc((d) => d && { ...d, progress }));
      setDoc((d) => ({ ...d, status: "ready", progress: 100 }));
      setConversation([]);
      message.success(`${file.name} is ready. Ask away.`);
    } catch (err) {
      setDoc((d) => ({ ...d, status: "error", error: err.message }));
      message.error(err.message);
    }
  };

  const updateLast = (patch) =>
    setConversation((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });

  const ask = (question) => {
    if (!ready || isLoading) return;
    setIsLoading(true);
    setConversation((prev) => [...prev, { question, ragAnswer: "" }]);
    closeStream.current = streamChat(question, {
      onRag: (ragAnswer) => updateLast({ ragAnswer }),
      onWeb: (mcpAnswer, mcpError) => updateLast({ mcpAnswer, mcpError }),
      onDone: () => {
        setIsLoading(false);
        setAnswerVersion((v) => v + 1);
      },
      onError: (msg) => {
        setIsLoading(false);
        message.error(msg);
      },
    });
  };

  const newChat = async () => {
    if (closeStream.current) closeStream.current();
    setIsLoading(false);
    setConversation([]);
    if (ready) {
      try {
        await resetHistory();
      } catch {
        message.warning("Cleared on screen, but the server history could not be reset.");
      }
    }
  };

  const last = conversation[conversation.length - 1];

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark">
            <IconSpark width={18} height={18} />
          </span>
          <div>
            <div className="brand-name">AgentAI</div>
            <div className="brand-sub">Chat with your PDF</div>
          </div>
        </div>

        <button type="button" className="new-chat" onClick={newChat} disabled={!conversation.length}>
          <IconPlus width={16} height={16} /> New chat
        </button>

        <div className="side-section">
          <div className="side-label">Document</div>
          {doc ? <DocCard doc={doc} /> : <p className="side-empty">No document yet.</p>}
          {doc && <Dropzone compact onFile={handleFile} disabled={doc.status === "uploading"} />}
        </div>

        <div className="side-section">
          <div className="side-label">How it answers</div>
          <ul className="how">
            <li>
              <span className="how-dot rag" />
              Retrieves the most relevant passages from your PDF and streams an answer grounded in them.
            </li>
            <li>
              <span className="how-dot web" />
              Asks a web-search tool over MCP at the same time; if it fails, the document answer still arrives.
            </li>
          </ul>
        </div>

        <div className="side-foot">
          <IconLock width={14} height={14} /> Session-scoped · files removed after 1 h idle
        </div>
      </aside>

      <main className="chat">
        <header className="chat-head">
          <div className="chat-title">
            {ready ? (
              <>
                <span className="live-dot" /> {doc.name}
              </>
            ) : (
              "New conversation"
            )}
          </div>
          <div className="chat-head-note">Answers come from your document first, the web second.</div>
        </header>

        <div className="chat-scroll" ref={scroller}>
          <div className="chat-inner">
            {!doc || doc.status === "error" ? (
              <section className="hero">
                <div className="hero-badge">
                  <IconSpark width={14} height={14} /> RAG + MCP · streaming
                </div>
                <h1>Ask questions about any PDF.</h1>
                <p className="hero-sub">
                  Upload a contract, a report or a paper. Get answers grounded in the document, with a second opinion
                  from the web.
                </p>
                <Dropzone onFile={handleFile} />
                <div className="features">
                  {FEATURES.map(({ icon: Icon, title, text }) => (
                    <div className="feature" key={title}>
                      <span className="feature-icon">
                        <Icon width={16} height={16} />
                      </span>
                      <div>
                        <strong>{title}</strong>
                        <span>{text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : conversation.length === 0 ? (
              <section className="ready">
                <div className="ready-icon">
                  <IconSpark width={22} height={22} />
                </div>
                <h2>{ready ? "Your document is ready" : "Preparing your document…"}</h2>
                <p className="hero-sub">Try one of these, or ask your own question below.</p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button type="button" key={s} className="suggestion" onClick={() => ask(s)} disabled={!ready}>
                      {s}
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <RenderQA conversation={conversation} isLoading={isLoading} docName={doc.name} />
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <ChatComponent
            onAsk={ask}
            isLoading={isLoading}
            disabled={!ready}
            lastAnswer={last?.ragAnswer}
            answerVersion={answerVersion}
          />
          <div className="composer-note">Enter to send · Shift + Enter for a new line</div>
        </div>
      </main>
    </div>
  );
};

export default App;
