import * as pollService from "../services/poll-service.ts";
import { MESSAGES } from "../constants/messages.ts";
import { validateField } from "../utils/validation.ts";
import { getConfig } from "../services/bot.ts";
import type { MyContext } from "../middleware/session.ts";

export async function handleGroupText(ctx: MyContext) {
  const text = ctx.message?.text || "";
  const isActive = await pollService.isPollActive();
  const { adminUserIds } = getConfig();
  const userId = ctx.from?.id;
  const isAdmin = userId ? adminUserIds.includes(userId) : false;

  if (/^\/\+/.test(text)) {
    if (!isActive && !isAdmin) {
      await ctx.reply(MESSAGES.NO_ACTIVE_POLL);
      return;
    }
    await pollService.handleVoteCommand(ctx);
  } else if (/^\/-/.test(text)) {
    await pollService.handleRevokeCommand(ctx);
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const parseVoteCommand = (
  text: string,
): { names?: string[]; count?: number } => {
  if (!text.startsWith("/+")) {
    throw new ValidationError(MESSAGES.INVALID_COMMAND_PLUS);
  }
  const args = text.substring(2).trim();
  if (!args) return { count: 1 };

  const numberMatch = args.match(/^\d+$/);
  if (numberMatch) {
    const count = validateField("voteCount", args) as number;
    return { count };
  }

  const names = args.split(/[,\s]+/).map((name) => name.trim()).filter((name) =>
    name.length > 0
  );
  if (names.length === 0) throw new ValidationError(MESSAGES.EMPTY_NAMES);
  if (names.length > 10) throw new ValidationError(MESSAGES.TOO_MANY_NAMES);

  for (const name of names) {
    validateField("userName", name);
    if (!/^[\p{L}\p{N}\s._-]+$/u.test(name)) {
      throw new ValidationError(MESSAGES.INVALID_NAME_CHARS);
    }
  }
  return { names };
};

export const parseRevokeCommand = (text: string): number => {
  if (!text.startsWith("/-")) {
    throw new ValidationError(MESSAGES.INVALID_COMMAND_MINUS);
  }
  const args = text.substring(2).trim();
  if (!args) throw new ValidationError(MESSAGES.VOTE_NUMBER_NOT_PROVIDED);

  const numberMatch = args.match(/^\d+$/);
  if (!numberMatch) {
    throw new ValidationError(MESSAGES.INVALID_VOTE_NUMBER_FORMAT);
  }

  return validateField("voteNumber", args) as number;
};
