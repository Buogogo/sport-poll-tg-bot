import { NextFunction } from "https://deno.land/x/grammy@v1.36.3/composer.ts";
import { Context } from "https://deno.land/x/grammy@v1.36.3/context.ts";
import { getConfig } from "../services/bot.ts";
import { logger } from "../utils/logger.ts";

export const onlyTargetGroup = () => (ctx: Context, next: NextFunction) => {
  const { targetGroupChatId } = getConfig();
  const currentChatId = ctx.chat?.id;
  
  logger.debug("Group middleware check", { 
    currentChatId, 
    targetGroupChatId, 
    chatType: ctx.chat?.type,
    isTargetGroup: currentChatId === targetGroupChatId 
  });
  
  if (currentChatId === targetGroupChatId) {
    logger.info(`Target group access granted for chat ${currentChatId}`);
    return next();
  }
  
  logger.warn(`Group access denied for chat ${currentChatId} (expected ${targetGroupChatId})`);
};
