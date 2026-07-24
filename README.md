# @gyga-browser/webmcp-zalo-notify

An [MCP](https://modelcontextprotocol.io) server for sending **proactive Zalo Bot
notifications** — `sendMessage`, `sendPhoto`, `sendChatAction` — with saved
recipient aliases. The bot token lives in the server environment, so the calling
agent never sees it and never has to be re-prompted for it.

Consumes the [Zalo Bot Platform API](https://bot.zapps.me). For the inbound
AI-chatbot runtime (webhook/polling + AI replies), see the separate
`webmcp-zalo-bot` app — this package is outbound-only and intentionally thin.

## Tools

| Tool | Description |
|------|-------------|
| `send_message` | Send text. `recipient` = alias or raw `chat_id`; optional `parse_mode` (`markdown`/`html`). |
| `send_photo` | Send an image by public URL, with optional caption. |
| `send_chat_action` | Show a `typing` / `upload_photo` indicator. |
| `list_contacts` | List saved aliases (name + chat type only — never tokens or chat_ids). |
| `get_me` | Verify the configured token and return bot account info. |

## CLI (`send`)

For processes that are not MCP clients (the fleet hub outbox), the same binary
takes a one-shot `send` subcommand — same token, same aliases, same client, so
there is exactly one outbound path:

```bash
webmcp-zalo-notify send --recipient ops-group --text "🚨 bot-down" [--json]
```

Exit codes: `0` sent, `1` the send failed, `2` usage/missing token. With
`--json`, every result uses schema `webmcp-zalo-notify-send/1`. Success exposes
only an alias/direct recipient classification and message metadata; failure
messages redact the bot token and recipient. Raw chat IDs are never echoed.
With no subcommand the binary is the MCP stdio server, exactly as before.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ZALO_BOT_TOKEN` | to send | Bot token, `<numeric_id>:<string>`. Held by the server only. |
| `ZALO_CONTACTS_PATH` | optional | Path to a JSON file mapping aliases to chat_ids. |

`ZALO_CONTACTS_PATH` JSON (aliases → chat_id; strings or objects):

```json
{
  "default_group": { "chat_id": "zgr-xxxx", "chat_type": "GROUP", "note": "Main alerts" },
  "personal_admin": "abcdef0123456789"
}
```

This file holds only chat_ids/aliases — **never** put the token in it.

## Register with Claude Code

```bash
claude mcp add zalo -s user \
  -e ZALO_BOT_TOKEN=<numeric_id>:<string> \
  -e ZALO_CONTACTS_PATH=/abs/path/contacts.local.json \
  -- npx -y @gyga-browser/webmcp-zalo-notify
```

Or in an `mcpServers` config block:

```json
{
  "mcpServers": {
    "zalo": {
      "command": "npx",
      "args": ["-y", "zalo-notify-mcp"],
      "env": {
        "ZALO_BOT_TOKEN": "<numeric_id>:<string>",
        "ZALO_CONTACTS_PATH": "/abs/path/contacts.local.json"
      }
    }
  }
}
```

Restart / reload the MCP client so the `zalo` tools become available. Then:

```
zalo.list_contacts()
zalo.send_message({ recipient: "default_group", text: "**Done** ✅", parse_mode: "markdown" })
```

## Local development

```bash
npm install
npm run smoke        # spawns the server, lists tools, calls list_contacts
# live connectivity (read-only, sends nothing):
ZALO_BOT_TOKEN=... ZALO_SMOKE_GETME=1 npm run smoke
```

## Notes

- Group `chat_id`s start with `zgr-`. Bot API IDs are not Zalo Web IDs.
- Text limit is 1–2000 chars. `parse_mode` supports Zalo markdown extensions
  (e.g. `{green}...{/green}`) and a limited HTML subset.
- stdout is the JSON-RPC channel; all logs go to stderr.

## License

MIT
