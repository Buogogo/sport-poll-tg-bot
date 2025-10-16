import { BotError, webhookCallback } from "grammy";
import { initializeBot } from "./services/bot.ts";
import { errorHandler } from "./middleware/error.ts";
import { logger } from "./utils/logger.ts";
import "./events/handlers.ts";

const { bot, config } = initializeBot();
const handleUpdate = webhookCallback(bot, "std/http");

logger.info("Bot initialized and webhook handler ready");
logger.info(`Webhook path: /${config.botToken.slice(0, 10)}...`);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  logger.debug(`Incoming request: ${req.method} ${url.pathname}`);
  
  if (req.method === "POST") {
    if (url.pathname.slice(1) === config.botToken) {
      try {
        const body = await req.clone().text();
        logger.info("Webhook received", { bodyLength: body.length });
        logger.debug("Webhook payload", { body: body.substring(0, 200) });
        return await handleUpdate(req);
      } catch (err) {
        logger.error("Error handling webhook", { err });
        return await errorHandler(err as BotError);
      }
    } else {
      logger.warn(`POST to wrong path: ${url.pathname}`);
    }
  }
  return new Response();
});
