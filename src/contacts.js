// Recipient-alias resolution from a JSON file at ZALO_CONTACTS_PATH.
//
// Accepted JSON shapes (per alias):
//   "default_group": "zgr-xxxx"
//   "ops_alerts":    { "chat_id": "zgr-yyyy", "chat_type": "GROUP", "note": "..." }
//
// The file holds only chat_ids/aliases — never tokens.

import { readFileSync } from "node:fs";

export function loadContacts(path) {
  if (!path) return {};
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    process.stderr.write(`[zalo-notify-mcp] contacts file not readable (${path}): ${err.message}\n`);
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`[zalo-notify-mcp] contacts file is not valid JSON (${path}): ${err.message}\n`);
    return {};
  }
  const out = {};
  for (const [alias, val] of Object.entries(parsed)) {
    if (typeof val === "string") {
      out[alias] = { chat_id: val };
    } else if (val && typeof val === "object" && typeof val.chat_id === "string") {
      out[alias] = { chat_id: val.chat_id, chat_type: val.chat_type, note: val.note };
    }
  }
  return out;
}

/** Resolve an alias to its chat_id; pass through anything not a known alias. */
export function resolveRecipient(recipient, contacts) {
  const hit = contacts[recipient];
  return hit ? hit.chat_id : recipient;
}
