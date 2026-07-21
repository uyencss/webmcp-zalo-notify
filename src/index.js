#!/usr/bin/env node
// zalo-notify-mcp — stdio MCP server for proactive Zalo Bot notifications.
//
// Env:
//   ZALO_BOT_TOKEN     (required to send) — "<numeric_id>:<string>"
//   ZALO_CONTACTS_PATH (optional)         — JSON file of alias -> chat_id
//
// All diagnostics go to stderr; stdout is the JSON-RPC channel.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ZaloBotClient, ZaloBotError } from "./zalo-client.js";
import { loadContacts, resolveRecipient } from "./contacts.js";

const TOKEN = process.env.ZALO_BOT_TOKEN;
const contacts = loadContacts(process.env.ZALO_CONTACTS_PATH);

function getClient() {
  if (!TOKEN) {
    throw new Error(
      "ZALO_BOT_TOKEN is not set in the MCP server environment. Re-register the server with -e ZALO_BOT_TOKEN=..."
    );
  }
  return new ZaloBotClient(TOKEN);
}

const ok = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });
const fail = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });

async function run(fn) {
  try {
    return ok(await fn());
  } catch (err) {
    if (err instanceof ZaloBotError) {
      return fail(`Zalo API error ${err.errorCode}: ${err.description}`);
    }
    return fail(err.message);
  }
}

const server = new McpServer({ name: "zalo-notify-mcp", version: "0.1.0" });

server.registerTool(
  "send_message",
  {
    title: "Send Zalo message",
    description:
      "Send a text notification to a Zalo chat. `recipient` is a saved alias (see list_contacts) or a raw Bot API chat_id (group ids start with 'zgr-'). Prefer parse_mode 'markdown' for headings/colors.",
    inputSchema: {
      recipient: z.string().describe("Saved alias or raw chat_id"),
      text: z.string().min(1).max(2000).describe("Message text, 1-2000 chars"),
      parse_mode: z.enum(["markdown", "html"]).optional().describe("Rich-text mode"),
    },
  },
  async ({ recipient, text, parse_mode }) =>
    run(async () => {
      const chatId = resolveRecipient(recipient, contacts);
      const res = await getClient().sendMessage(chatId, text, { parseMode: parse_mode });
      return {
        sent: true,
        chat_id: chatId,
        message_id: res.result?.message_id,
        date: res.result?.date,
      };
    })
);

server.registerTool(
  "send_photo",
  {
    title: "Send Zalo photo",
    description:
      "Send an image notification by URL to a Zalo chat. `recipient` is a saved alias or raw chat_id.",
    inputSchema: {
      recipient: z.string().describe("Saved alias or raw chat_id"),
      photo_url: z.string().url().describe("Public image URL"),
      caption: z.string().max(2000).optional().describe("Optional caption, up to 2000 chars"),
    },
  },
  async ({ recipient, photo_url, caption }) =>
    run(async () => {
      const chatId = resolveRecipient(recipient, contacts);
      const res = await getClient().sendPhoto(chatId, photo_url, caption);
      return { sent: true, chat_id: chatId, message_id: res.result?.message_id };
    })
);

server.registerTool(
  "send_chat_action",
  {
    title: "Send Zalo chat action",
    description: "Show a 'typing' or 'upload_photo' indicator in a Zalo chat before a message.",
    inputSchema: {
      recipient: z.string().describe("Saved alias or raw chat_id"),
      action: z.enum(["typing", "upload_photo"]).default("typing"),
    },
  },
  async ({ recipient, action }) =>
    run(async () => {
      const chatId = resolveRecipient(recipient, contacts);
      await getClient().sendChatAction(chatId, action);
      return { ok: true, chat_id: chatId, action };
    })
);

server.registerTool(
  "list_contacts",
  {
    title: "List Zalo recipient aliases",
    description:
      "List saved recipient aliases usable as `recipient` in send_message. Returns alias names and chat types only — never tokens or the underlying chat_ids.",
    inputSchema: {},
  },
  async () =>
    run(async () => {
      const entries = Object.entries(contacts).map(([alias, c]) => ({
        alias,
        chat_type: c.chat_type ?? null,
        note: c.note ?? null,
      }));
      return { count: entries.length, contacts: entries, source: process.env.ZALO_CONTACTS_PATH ?? null };
    })
);

server.registerTool(
  "get_me",
  {
    title: "Verify Zalo bot token",
    description: "Call Zalo getMe to verify the configured token and return the bot account info.",
    inputSchema: {},
  },
  async () => run(async () => (await getClient().getMe()).result)
);

if (process.argv[2] === "send") {
  const { runSend } = await import("./send.js");
  process.exitCode = await runSend(process.argv.slice(3));
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[zalo-notify-mcp] ready (token: ${TOKEN ? "set" : "MISSING"}, contacts: ${Object.keys(contacts).length})\n`
  );
}
