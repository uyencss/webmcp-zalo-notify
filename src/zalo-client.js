// Thin Zalo Bot API client (native fetch, no runtime deps).
// Token is embedded in the URL path per the Zalo Bot Platform API.

export class ZaloBotError extends Error {
  constructor(errorCode, description) {
    super(`[${errorCode}] ${description}`);
    this.name = "ZaloBotError";
    this.errorCode = errorCode;
    this.description = description;
  }
}

export class ZaloBotClient {
  static BASE_URL = "https://bot-api.zaloplatforms.com";

  /** @param {string} botToken - "<numeric_id>:<string>" */
  constructor(botToken) {
    if (!botToken || !botToken.includes(":")) {
      throw new Error("Invalid ZALO_BOT_TOKEN format. Expected '<numeric_id>:<string>'.");
    }
    this.base = `${ZaloBotClient.BASE_URL}/bot${botToken}`;
  }

  async _call(method, payload = {}) {
    const res = await fetch(`${this.base}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res
      .json()
      .catch(() => ({ ok: false, description: `Non-JSON response (HTTP ${res.status})` }));
    if (!data.ok) {
      throw new ZaloBotError(data.error_code || res.status, data.description || "Unknown error");
    }
    return data;
  }

  getMe() {
    return this._call("getMe");
  }

  sendMessage(chatId, text, { parseMode } = {}) {
    const payload = { chat_id: chatId, text };
    if (parseMode) payload.parse_mode = parseMode;
    return this._call("sendMessage", payload);
  }

  sendPhoto(chatId, photoUrl, caption) {
    const payload = { chat_id: chatId, photo: photoUrl };
    if (caption) payload.caption = caption;
    return this._call("sendPhoto", payload);
  }

  sendChatAction(chatId, action = "typing") {
    return this._call("sendChatAction", { chat_id: chatId, action });
  }
}
