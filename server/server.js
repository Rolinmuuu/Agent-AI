import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import chat from "./chat.js";
import chatMCP from "./chat-mcp.js";

dotenv.config();

const app = express();
// cors 我们叫做 middleware，中间件
app.use(cors());

// config multer
// 用户上传的文件会存储到 uploads 文件夹中
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const PORT = 5001;

let filePath;

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    filePath = req.file.path;
    res.send("File uploaded successfully");
  } catch (error) {
    res.status(500).send("Failed to upload file");
  }
});

app.get("/chat", async (req, res) => {
  try {
    const mcpResponse = await chatMCP(req.query.question);
    const ragResponse = await chat(filePath, req.query.question);
    res.send({
      ragAnswer: ragResponse.text,
      mcpAnswer: mcpResponse.text,
    });
  } catch (error) {
    res.status(500).send("Failed to chat");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
