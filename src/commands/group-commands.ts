import * as pollService from "../services/poll-service.ts";
import { MESSAGES } from "../constants/messages.ts";
import type { MyContext } from "../middleware/session.ts";

export async function handleGroupText(ctx: MyContext) {
  const text = ctx.message?.text || "";
  if (!pollService.isPollActive()) {
    await ctx.reply(MESSAGES.NO_ACTIVE_POLL);
    return;
  }
  if (/^\/\+/.test(text)) {
    await pollService.handleVoteCommand(ctx);
  } else if (/^\/-/.test(text)) {
    await pollService.handleRevokeCommand(ctx);
  }
}
