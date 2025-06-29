import { Context, NextFunction } from "grammy";
import { getConfig } from "../services/bot.ts";

export const onlyAdmin = () => (ctx: Context, next: NextFunction) => {
  if (
    ctx.from &&
    getConfig().adminUserIds.includes(ctx.from.id)
  ) return next();
};
