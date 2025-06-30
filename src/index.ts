import { webhookCallback } from "grammy";
import { initializeBot } from "./services/bot.ts";
import * as pollService from "./services/poll-service.ts";
import { logger } from "./utils/logger.ts";

const { bot, config } = initializeBot();
const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  if (req.method === "POST") {
    const url = new URL(req.url);
    if (url.pathname.slice(1) === config.botToken) {
      await pollService.loadPersistedData();
      try {
        return await handleUpdate(req);
      } catch (err) {
        logger.error(err);
        return new Response("Error", { status: 500 });
      }
    }
  }
  return new Response();
});
