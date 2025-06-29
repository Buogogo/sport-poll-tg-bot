import * as Sentry from "sentry";
import { initializeBot } from "./services/bot.ts";
import { clearSchedule, initializeScheduler } from "./services/scheduler.ts";
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
    const shutdown = () => {
      logger.info("Shutting down gracefully...");
      clearSchedule();
      bot.stop();
      Deno.exit(0);
    };
    Deno.addSignalListener("SIGINT", shutdown);
    Deno.addSignalListener("SIGTERM", shutdown);
    await bot.start({
      onStart: (botInfo: { username: string }) => {
        logger.info(`Bot @${botInfo.username} started!`);
      },
    });
  } catch (_error) {
    Deno.exit(1);
  }
};

if (import.meta.main) main().catch(console.error);
