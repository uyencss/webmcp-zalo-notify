// Smoke test: spawn the stdio MCP server and verify the tool surface.
// Does NOT send any Zalo message. If ZALO_BOT_TOKEN + ZALO_SMOKE_GETME=1 are
// set, it also calls get_me (read-only) to confirm live connectivity.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "src", "index.js");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  env: { ...process.env },
});

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
console.log("tools:", names.join(", "));

const expected = ["get_me", "list_contacts", "send_chat_action", "send_message", "send_photo"];
const missing = expected.filter((n) => !names.includes(n));
if (missing.length) {
  console.error("MISSING tools:", missing.join(", "));
  process.exit(1);
}

const lc = await client.callTool({ name: "list_contacts", arguments: {} });
console.log("list_contacts:", lc.content[0].text);

if (process.env.ZALO_BOT_TOKEN && process.env.ZALO_SMOKE_GETME === "1") {
  const me = await client.callTool({ name: "get_me", arguments: {} });
  console.log("get_me:", me.isError ? `ERROR ${me.content[0].text}` : "ok");
}

await client.close();
console.log("SMOKE OK");
process.exit(0);
