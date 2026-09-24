import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import chat, { forgetFile } from "./chat.js";
import chatMCP from "./chat-mcp.js";
import { createApp } from "./app.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5001;

const app = createApp({
  chat,
  chatMCP,
  forgetFile,
  uploadDir: path.join(__dirname, "uploads"),
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
