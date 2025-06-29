import * as Sentry from "sentry";
import { BotError } from "grammy";
import { UserFacingError } from "../constants/types.ts";
import { logger } from "../utils/logger.ts";

export const errorHandler = async (
  error: BotError,
) => {
  if (error.message.includes("message is not modified")) {
    logger.debug("Error ignored: message is not modified");
    return;
  }
  if (error.error instanceof UserFacingError) {
    try {
      await error.ctx.reply(error.error.message);
    } catch (replyError) {
      logger.error("Failed to send user error message", { replyError });
    }
  } else {
    logger.error("Unhandled bot error", { error });
    Sentry.captureException(error);
  }
};
