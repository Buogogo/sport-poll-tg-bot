import { BotError, webhookCallback } from "grammy";
import { initializeBot } from "./services/bot.ts";
import { errorHandler } from "./middleware/error.ts";
import "./events/handlers.ts";

const { bot, config } = initializeBot();
const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  if (req.method === "POST") {
    const url = new URL(req.url);
    if (url.pathname.slice(1) === config.botToken) {
      try {
        return await handleUpdate(req);
      } catch (err) {
        return await errorHandler(err as BotError);
      }
    }
  }
  return new Response();
});
