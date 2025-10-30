// routes/messageBuilder.js
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Ensure fetch works even if Node <18

dotenv.config();

const router = express.Router();
const DISCORD_API = "https://discord.com/api/v10";

function requireBotToken() {
  if (!process.env.BOT_TOKEN) {
    const msg = "BOT_TOKEN is missing from .env";
    console.error(msg);
    throw new Error(msg);
  }
}

async function dapi(path, init = {}) {
  requireBotToken();
  const headers = {
    Authorization: `Bot ${process.env.BOT_TOKEN}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  return fetch(`${DISCORD_API}${path}`, { ...init, headers });
}

/**
 * GET /api/channels/:guildId
 * Lists text channels (type 0) the bot can see in the guild
 */
router.get("/channels/:guildId", async (req, res) => {
  try {
    const { guildId } = req.params;

    const resp = await dapi(`/guilds/${guildId}/channels`);
    const text = await resp.text();

    if (!resp.ok) {
      console.error("Discord channel fetch failed:", resp.status, text);
      return res.status(resp.status).json({
        error: "discord_error",
        status: resp.status,
        detail: text,
      });
    }

    let channels;
    try {
      channels = JSON.parse(text);
    } catch (err) {
      console.error("Bad JSON:", err);
      return res.status(502).json({ error: "bad_gateway" });
    }

    const textChannels = (channels || [])
      .filter(c => c?.type === 0)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(c => ({ id: c.id, name: c.name }));

    res.json(textChannels);
  } catch (err) {
    console.error("GET /api/channels error:", err);
    res.status(500).json({ error: "server_error", detail: err.message });
  }
});

/**
 * POST /api/sendMessage
 * Sends a message via bot token.
 */
router.post("/sendMessage", async (req, res) => {
  try {
    requireBotToken();
    const { channelId, content, embeds } = req.body || {};
    if (!channelId)
      return res.status(400).json({ error: "bad_request", detail: "channelId missing" });

    const normalizedEmbeds = Array.isArray(embeds)
      ? embeds.map(e => {
          const out = {};
          if (e.title) out.title = e.title.slice(0, 256);
          if (e.description) out.description = e.description.slice(0, 4096);
          if (e.color) {
            const parsed = parseInt(e.color.replace("#", ""), 16);
            if (!Number.isNaN(parsed)) out.color = parsed;
          }
          if (e.footer) out.footer = { text: e.footer.slice(0, 2048) };
          if (e.thumbnail) out.thumbnail = { url: e.thumbnail };
          if (e.image) out.image = { url: e.image };
          return out;
        })
      : [];

    const payload = {
      content: content ?? "",
      embeds: normalizedEmbeds,
    };

    const resp = await dapi(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("Discord sendMessage failed:", resp.status, text);
      return res.status(resp.status).json({
        error: "discord_error",
        status: resp.status,
        detail: text,
      });
    }

    let data = {};
    try {
      data = JSON.parse(text);
    } catch {}
    res.json({ success: true, messageId: data.id });
  } catch (err) {
    console.error("POST /api/sendMessage error:", err);
    res.status(500).json({ error: "server_error", detail: err.message });
  }
});

export default router;


