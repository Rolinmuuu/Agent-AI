import crypto from "crypto";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createSessionStore } from "./sessions.js";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_QUESTION_CHARS = 2000;

const sessionIdOf = (req) => req.get("x-session-id") || req.query.sessionId;

/**
 * Build the Express app. `chat` and `chatMCP` are injected so the HTTP layer
 * can be tested without OpenAI / SerpAPI keys.
 */
export const createApp = ({
  chat,
  chatMCP,
  uploadDir,
  forgetFile = () => {},
  sessionOptions = {},
}) => {
  fs.mkdirSync(uploadDir, { recursive: true });

  const removeFile = (filePath) => {
    if (!filePath) return;
    forgetFile(filePath);
    fs.promises.unlink(filePath).catch(() => {});
  };

  const sessions = createSessionStore({
    ...sessionOptions,
    onExpire: (session) => removeFile(session.filePath),
  });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      // Never trust the client's file name: two users uploading "report.pdf"
      // used to overwrite each other, and the name could contain path tricks.
      filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}.pdf`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (req, file, cb) => {
      const isPdf =
        file.mimetype === "application/pdf" ||
        path.extname(file.originalname).toLowerCase() === ".pdf";
      cb(isPdf ? null : new Error("Only PDF files are supported"), isPdf);
    },
  });

  const app = express();
  app.use(cors());

  const requireSession = (req, res, next) => {
    const session = sessions.get(sessionIdOf(req));
    if (!session) {
      return res.status(400).send("Missing or invalid session id");
    }
    req.session = session;
    next();
  };

  app.post("/upload", requireSession, (req, res) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).send(err.message);
      if (!req.file) return res.status(400).send("No file received");
      const previous = sessions.setFile(req.session, req.file.path);
      removeFile(previous);
      res.send("File uploaded successfully");
    });
  });

  app.get("/chat", requireSession, async (req, res) => {
    const session = req.session;
    const question = String(req.query.question || "").trim();
    if (!session.filePath) {
      return res.status(400).send("Please upload a file first");
    }
    if (!question || question.length > MAX_QUESTION_CHARS) {
      return res.status(400).send("Question must be 1-2000 characters");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let clientGone = false;
    res.on("close", () => {
      clientGone = true;
    });
    const send = (payload) => {
      if (!clientGone) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Web search runs concurrently with the document answer. It is optional:
    // a failure here must not crash the process (an un-awaited rejected promise
    // would) or hide a good document answer.
    const mcpPromise = Promise.resolve()
      .then(() => chatMCP(question))
      .then((r) => ({ text: r?.text ?? null }))
      .catch((error) => ({ text: null, error: error.message }));

    try {
      const stream = await chat(session.filePath, question, session.chatHistory);
      let fullRagResponse = "";
      for await (const chunk of stream) {
        if (clientGone) break;
        const text = chunk?.content;
        if (text) {
          fullRagResponse += text;
          send({ ragAnswer: fullRagResponse });
        }
      }
      if (!clientGone) {
        sessions.appendExchange(
          session,
          new HumanMessage(question),
          new AIMessage(fullRagResponse),
        );
      }

      const mcp = await mcpPromise;
      send(mcp.text !== null ? { mcpAnswer: mcp.text } : { mcpAnswer: null, mcpError: "Web search unavailable" });
      send({ done: true });
    } catch (error) {
      await mcpPromise;
      send({ error: error.message });
    } finally {
      if (!clientGone) res.end();
    }
  });

  app.post("/reset-chat-history", requireSession, (req, res) => {
    sessions.reset(req.session);
    res.send("Chat history reset successfully");
  });

  app.locals.sessions = sessions;
  return app;
};
