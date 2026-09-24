import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { createApp } from "../app.js";
import { createSessionStore } from "../sessions.js";

const PDF_BYTES = Buffer.from("%PDF-1.4\n% test fixture\n%%EOF\n");
const calls = [];
let server;
let base;
let uploadDir;
let mcpMode = "ok";

// Fake RAG chain: echoes which file it was asked about, streamed in two chunks.
const fakeChat = async (filePath, question, history) => {
  calls.push({ filePath, question, historyLength: history.length });
  return (async function* () {
    yield { content: `answer from ${path.basename(filePath)}` };
    yield { content: ` to: ${question}` };
  })();
};

const fakeMCP = async () => {
  if (mcpMode === "fail") throw new Error("SerpAPI key missing");
  return { text: "web summary" };
};

before(async () => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-uploads-"));
  const app = createApp({ chat: fakeChat, chatMCP: fakeMCP, uploadDir });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

const upload = (sessionId, name = "doc.pdf", bytes = PDF_BYTES, type = "application/pdf") => {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  return fetch(`${base}/upload`, {
    method: "POST",
    body: form,
    headers: { "x-session-id": sessionId },
  });
};

const ask = async (sessionId, question) => {
  const res = await fetch(
    `${base}/chat?sessionId=${sessionId}&question=${encodeURIComponent(question)}`,
  );
  const body = await res.text();
  const events = body
    .split("\n\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
  return { status: res.status, events, body };
};

test("requests without a valid session id are rejected", async () => {
  const res = await fetch(`${base}/chat?question=hi`);
  assert.equal(res.status, 400);
  const bad = await upload("../../etc");
  assert.equal(bad.status, 400);
});

test("each session only sees its own document", async () => {
  assert.equal((await upload("sessionAAAA", "a.pdf")).status, 200);
  assert.equal((await upload("sessionBBBB", "b.pdf")).status, 200);

  const sessions = [...fs.readdirSync(uploadDir)];
  assert.equal(sessions.length, 2, "uploads get unique server-side names");

  const a = await ask("sessionAAAA", "q1");
  const b = await ask("sessionBBBB", "q1");
  const lastA = calls.at(-2).filePath;
  const lastB = calls.at(-1).filePath;
  assert.notEqual(lastA, lastB);
  assert.equal(a.events.at(-1).done, true);
  assert.equal(b.events.at(-1).done, true);
});

test("chat history is kept per session", async () => {
  await upload("sessionCCCC");
  await ask("sessionCCCC", "first");
  await ask("sessionCCCC", "second");
  assert.equal(calls.at(-1).historyLength, 2);

  await upload("sessionDDDD");
  await ask("sessionDDDD", "only");
  assert.equal(calls.at(-1).historyLength, 0);
});

test("asking before uploading is a 400, not a crash", async () => {
  const res = await ask("sessionEEEE", "hello");
  assert.equal(res.status, 400);
});

test("non-PDF uploads are refused", async () => {
  const res = await upload("sessionFFFF", "notes.txt", Buffer.from("hi"), "text/plain");
  assert.equal(res.status, 400);
});

test("a failing web search still returns the document answer", async () => {
  mcpMode = "fail";
  await upload("sessionGGGG");
  const { events } = await ask("sessionGGGG", "why");
  mcpMode = "ok";
  const rag = events.filter((e) => e.ragAnswer).at(-1).ragAnswer;
  assert.match(rag, /answer from .* to: why/);
  assert.ok(events.some((e) => e.mcpAnswer === null && e.mcpError));
  assert.equal(events.at(-1).done, true);
});

test("reset clears only the caller's history", async () => {
  await upload("sessionHHHH");
  await ask("sessionHHHH", "x");
  const res = await fetch(`${base}/reset-chat-history`, {
    method: "POST",
    headers: { "x-session-id": "sessionHHHH" },
  });
  assert.equal(res.status, 200);
  await ask("sessionHHHH", "y");
  assert.equal(calls.at(-1).historyLength, 0);
});

test("session store trims history and expires idle sessions", () => {
  let t = 0;
  const expired = [];
  const store = createSessionStore({
    ttlMs: 1000,
    maxExchanges: 2,
    now: () => t,
    onExpire: (s) => expired.push(s.id),
  });
  const s = store.get("sessionIIII");
  for (let i = 0; i < 5; i += 1) store.appendExchange(s, `h${i}`, `a${i}`);
  assert.deepEqual(s.chatHistory, ["h3", "a3", "h4", "a4"]);

  t = 5000;
  store.get("sessionJJJJ");
  assert.deepEqual(expired, ["sessionIIII"]);
  assert.equal(store.get("bad id!"), null);
});
