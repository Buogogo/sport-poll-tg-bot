import { NextFunction } from "https://deno.land/x/grammy@v1.36.3/composer.ts";
import { Context } from "https://deno.land/x/grammy@v1.36.3/context.ts";
import { getConfig } from "../services/bot.ts";

export const onlyTargetGroup = () => (ctx: Context, next: NextFunction) => {
  const { targetGroupChatId } = getConfig();
  if (ctx.chat?.id === targetGroupChatId) return next();
};
