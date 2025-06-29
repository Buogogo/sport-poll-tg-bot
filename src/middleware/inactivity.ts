import type { MyContext } from "./session.ts";
import { sessionEvt } from "../events/events.ts";
import { MESSAGES } from "../constants/messages.ts";

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const inactivityMiddleware =
  () => async (ctx: MyContext, next: () => Promise<void>) => {
    const now = Date.now();
    const lastActive = ctx.session.lastActiveAt ?? 0;
    if (lastActive && now - lastActive > INACTIVITY_TIMEOUT_MS) {
      // Inactive: trigger session reset via event
      sessionEvt.post({ type: "session_reset", ctx });
      await ctx.reply(MESSAGES.INACTIVITY_SESSION_RESET, {
        reply_markup: undefined,
      });
      return;
    }

    // Update last activity timestamp
    ctx.session.lastActiveAt = now;
    await next();
  };
