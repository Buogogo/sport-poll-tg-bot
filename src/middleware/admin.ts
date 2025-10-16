import { Context, NextFunction } from "grammy";
import { getConfig } from "../services/bot.ts";
import { logger } from "../utils/logger.ts";

export const onlyAdmin = () => (ctx: Context, next: NextFunction) => {
  const userId = ctx.from?.id;
  const adminIds = getConfig().adminUserIds;
  
  logger.debug("Admin middleware check", { 
    userId, 
    adminIds, 
    isAdmin: userId ? adminIds.includes(userId) : false 
  });
  
  if (ctx.from && adminIds.includes(ctx.from.id)) {
    logger.info(`Admin access granted for user ${userId}`);
    return next();
  }
  
  logger.warn(`Admin access denied for user ${userId}`);
};
