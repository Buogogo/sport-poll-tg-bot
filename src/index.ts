import { webhookCallback } from "https://deno.land/x/grammy@v1.36.3/mod.ts";
import { initializeBot } from "./services/bot.ts";
import * as pollService from "./services/poll-service.ts";
import { logger } from "./utils/logger.ts";

const { bot, config } = initializeBot();
const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  if (req.method === "POST") {
    const url = new URL(req.url);
    // Use bot token as secret webhook path
    if (url.pathname.slice(1) === config.botToken) {
      await pollService.loadPersistedData();
      try {
        return await handleUpdate(req);
      } catch (err) {
        logger.error("Webhook handler error", { err });
        return new Response("Error", { status: 500 });
      }
    }
  }
  return new Response();
});
