import { getAdminSession, resetSession } from "../middleware/session.ts";
import { mainMenu } from "../menus/admin-menu.ts";
import { MESSAGES } from "../constants/messages.ts";
import type { MyContext } from "../middleware/session.ts";

export async function handleStart(ctx: MyContext) {
  const session = getAdminSession(ctx);
  const message = await ctx.reply(MESSAGES.MAIN_MENU_TITLE, {
    reply_markup: mainMenu,
    parse_mode: "Markdown",
  });
  session.lastMenuMessageId = message.message_id;
}

export async function handleReset(ctx: MyContext) {
  // Exit all active conversations for this user
  await ctx.conversation.exit();
  // Cleanly reset session
  resetSession(ctx);
  // Show main menu or confirmation
  await ctx.reply(MESSAGES.ADMIN_INTERFACE_RESET, { reply_markup: mainMenu });
}
