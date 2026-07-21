// `webmcp-zalo-notify send` — one-shot CLI send for processes that are not MCP
// clients (the fleet hub outbox). Reuses the same client/alias internals as the
// MCP server so token and alias logic live in exactly one place.

import { ZaloBotClient, ZaloBotError } from "./zalo-client.js";
import { loadContacts, resolveRecipient } from "./contacts.js";

const USAGE = `webmcp-zalo-notify send --recipient <alias|chat_id> --text <message> [--json]

Options:
  --recipient <alias>  Saved alias (see ZALO_CONTACTS_PATH) or raw chat_id
  --text <message>     Message text, 1-2000 chars
  --json               Print a JSON result on stdout
  --help               Show this message

Env:
  ZALO_BOT_TOKEN       required — "<numeric_id>:<string>"
  ZALO_CONTACTS_PATH   optional — JSON file of alias -> chat_id
`;

const VALUE_OPTIONS = new Set(["recipient", "text"]);
const BOOLEAN_OPTIONS = new Set(["json", "help"]);

class UsageError extends Error {}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new UsageError(`Unexpected argument: ${token}`);
    const equalAt = token.indexOf("=");
    const name = token.slice(2, equalAt >= 0 ? equalAt : undefined);
    if (BOOLEAN_OPTIONS.has(name)) {
      options[name] = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) throw new UsageError(`Unknown option --${name}`);
    const value = equalAt >= 0 ? token.slice(equalAt + 1) : argv[++index];
    if (value === undefined) throw new UsageError(`--${name} requires a value`);
    options[name] = value;
  }
  return options;
}

export async function runSend(argv, {
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    stderr.write(`USAGE_ERROR: ${err.message}\n\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    stdout.write(USAGE);
    return 0;
  }

  const fail = (code, message, exitCode) => {
    if (options.json) stdout.write(`${JSON.stringify({ ok: false, error: { code, message } })}\n`);
    else stderr.write(`${code}: ${message}\n`);
    return exitCode;
  };

  if (!options.recipient || !options.text) {
    return fail("USAGE_ERROR", "--recipient and --text are required", 2);
  }
  if (!env.ZALO_BOT_TOKEN) {
    return fail("MISSING_TOKEN", "ZALO_BOT_TOKEN is not set in the environment", 2);
  }

  try {
    const chatId = resolveRecipient(options.recipient, loadContacts(env.ZALO_CONTACTS_PATH));
    const res = await new ZaloBotClient(env.ZALO_BOT_TOKEN).sendMessage(chatId, options.text);
    const result = {
      ok: true,
      sent: true,
      chat_id: chatId,
      message_id: res.result?.message_id ?? null,
      date: res.result?.date ?? null,
    };
    if (options.json) stdout.write(`${JSON.stringify(result)}\n`);
    else stdout.write(`sent to ${options.recipient} (message_id ${result.message_id})\n`);
    return 0;
  } catch (err) {
    const code = err instanceof ZaloBotError ? `ZALO_${err.errorCode}` : "SEND_FAILED";
    return fail(code, err.message, 1);
  }
}
