import * as Sentry from "sentry";
import { initializeBot } from "./services/bot.ts";
import { initializeScheduler } from "./services/scheduler.ts";
import * as pollService from "./services/poll-service.ts";
import { logger } from "./utils/logger.ts";

const main = async () => {
  try {
    Sentry.init({
      environment: Deno.env.get("ENV"),
      dsn:
        "https://8064e4ec38387cae1275fcde47d567ae@o4509553547149312.ingest.de.sentry.io/4509553550819408",
    });
    await pollService.loadPersistedData();
    await initializeScheduler();
    const { bot } = initializeBot();
    await bot.start({
      onStart: (botInfo: { username: string }) => {
        logger.info(`Bot @${botInfo.username} started!`);
      },
    });
  } catch (err) {
    Sentry.captureException(err);
  }
};

if (import.meta.main) main().catch(console.error);

const { bot } = initializeBot();

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/webhook" && req.method === "POST") {
    await pollService.loadPersistedData();
    const update = await req.json();
    try {
      await bot.handleUpdate(update);
      return new Response("OK");
    } catch {
      return new Response("Error", { status: 500 });
    }
  }
  return new Response("OK");
});
