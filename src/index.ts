#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const apiKey = process.env.YOUGILE_API_KEY;
if (!apiKey) {
  console.error("Error: YOUGILE_API_KEY environment variable is required.");
  console.error("Get your API key: POST https://ru.yougile.com/api-v2/auth/keys");
  process.exit(1);
}

const server = createServer(apiKey);
const transport = new StdioServerTransport();
await server.connect(transport);
