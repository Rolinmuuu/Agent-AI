import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getJson } from "serpapi";

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

const server = new McpServer({
  name: "serpapi-search",
  version: "1.0.0",
});

server.registerTool(
  "search_web",
  {
    description: "Search the web using SerpAPI and return the results",
    inputSchema: {
      query: z.string().describe("The search query to be executed"),
      num: z
        .number()
        .optional()
        .describe("The number of results to return (default: 10)"),
    },
  },
  async ({ query, num = 10 }) => {
    try {
      const results = await getJson({
        engine: "google",
        q: query,
        num: num,
        api_key: SERPAPI_API_KEY,
      });

      const fullResults = JSON.stringify(results); // obj -> JSON

      return {
        content: [
          {
            type: "text",
            text: fullResults,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to search the web" + error,
          },
        ],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SerpAPI MCP server is running on stdio");
}

main().catch((error) => {
  console.error("Error starting MCP server:", error);
  process.exit(1);
});

export default server;
