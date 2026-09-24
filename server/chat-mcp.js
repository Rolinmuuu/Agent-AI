import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "gpt-4o";

// One MCP client (and one stdio child process) shared by all requests.
let client = null;
let connectionPromise = null;

const ensureConnected = async () => {
  if (client) return;
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const next = new Client({ name: "chat-client", version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: "node",
        args: [join(__dirname, "mcp-server.js")],
        env: { ...process.env },
      });
      await next.connect(transport);
      client = next;
    })().finally(() => {
      connectionPromise = null;
    });
  }
  // Every caller, including the one that started the connection, waits for the
  // handshake. The previous version returned early for the first caller, so its
  // tool call could race the MCP initialize request.
  await connectionPromise;
};

const resetClient = async () => {
  const stale = client;
  client = null;
  if (stale) {
    try {
      await stale.close();
    } catch {}
  }
};

const chatMCP = async (query) => {
  const apiKey = process.env.OPENAI_API_KEY;
  try {
    await ensureConnected();
    const toolResult = await client.callTool({
      name: "search_web",
      arguments: { query, num: 5 },
    });
    const searchResults = toolResult.content?.[0]?.text || "";

    const prompt = PromptTemplate.fromTemplate(
      `Summarize the search result.
Search Results: {searchResults}
Helpful Answer:`,
    );
    const formattedPrompt = await prompt.format({
      searchResults: searchResults || "No search results available",
    });
    const model = new ChatOpenAI({ model: SUMMARY_MODEL, apiKey });
    const response = await model.invoke(formattedPrompt);
    return { text: response.content };
  } catch (error) {
    await resetClient();
    throw error;
  }
};

export default chatMCP;
