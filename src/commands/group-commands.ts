import * as pollService from "../services/poll-service.ts";
import { MESSAGES } from "../constants/messages.ts";
import { validateField } from "../utils/validation.ts";
import type { MyContext } from "../middleware/session.ts";
import { UserFacingError } from "../constants/types.ts";

export async function handleGroupText(ctx: MyContext) {
  const { message } = ctx;
  const text = message?.text || "";
  if (!pollService.isPollActive()) {
    await ctx.reply(MESSAGES.NO_ACTIVE_POLL);
    return;
  }
  if (/^\+/.test(text)) {
    await pollService.handleVoteCommand(ctx);
  } else if (/^\-/.test(text)) {
    await pollService.handleRevokeCommand(ctx);
  }
}

export const parseVoteCommand = (
  ctx: MyContext,
): { names?: string[]; count?: number } => {
  const text = ctx.message?.text || "";
  const args = text.substring(2).trim();
  if (!args) return { count: 1 };

  const numberMatch = args.match(/^\d+$/);
  if (numberMatch) {
    const count = validateField(ctx, "voteCount", args) as number;
    return { count };
  }

  const names = args.split(/\s*,\s*/).map((name) => name.trim()).filter((
    name,
  ) => name.length > 0);
  if (names.length === 0) throw new UserFacingError(ctx, MESSAGES.EMPTY_NAMES);
  if (names.length > 10) {
    throw new UserFacingError(ctx, MESSAGES.TOO_MANY_NAMES);
  }

  for (const name of names) {
    validateField(ctx, "userName", name);
    if (!/^[\p{L}\p{N}\s._-]+$/u.test(name)) {
      throw new UserFacingError(ctx, MESSAGES.INVALID_NAME_CHARS);
    }
  }
  return { names };
};

export const parseRevokeCommand = (ctx: MyContext): number => {
  const { message } = ctx;
  const text = message?.text || "";
  const args = text.substring(2).trim();
  if (!args) throw new UserFacingError(ctx, MESSAGES.VOTE_NUMBER_NOT_PROVIDED);

  const numberMatch = args.match(/^\d+$/);
  if (!numberMatch) {
    throw new UserFacingError(ctx, MESSAGES.INVALID_VOTE_NUMBER_FORMAT);
  }

  return validateField(ctx, "voteNumber", args) as number;
};
