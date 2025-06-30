import * as Sentry from "sentry";
import { BotError } from "grammy";
import { UserFacingError } from "../constants/types.ts";
import { logger } from "../utils/logger.ts";

export const errorHandler = async (
  error: BotError,
): Promise<Response> => {
  if (error.message.includes("message is not modified")) {
    logger.info("Menu refresh ignored: message is not modified");
    if (error.ctx.callbackQuery) {
      try {
        await error.ctx.answerCallbackQuery("Вже оновлено!");
      } catch (e) {
        logger.error("Failed to answer callback query", { e });
      }
    }
    return new Response("OK");
  }
  try {
    if (error.error instanceof UserFacingError) {
      await error.ctx.reply(error.error.message);
      return new Response("User error", { status: 200 });
    } else {
      logger.error("Unhandled bot error", { error });
      Sentry.captureException(error);
      await error.ctx.reply(
        "An unexpected error occurred. Please try again later.",
      );
      return new Response("Bot error", { status: 500 });
    }
  } catch (replyError) {
    logger.error("Failed to send error message to user", { replyError });
    return new Response("Error", { status: 500 });
  }
};
