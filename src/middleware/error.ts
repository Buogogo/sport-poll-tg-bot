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
  try {
    if (error.error instanceof UserFacingError) {
      await error.ctx.reply(error.error.message);
    } else {
      logger.error("Unhandled bot error", { error });
      Sentry.captureException(error);
      // Attempt to reply with a generic error message
      await error.ctx.reply(
        "An unexpected error occurred. Please try again later.",
      );
    }
  } catch (replyError) {
    logger.error("Failed to send error message to user", { replyError });
    // Do not throw further, just ensure the function completes
  }
};
