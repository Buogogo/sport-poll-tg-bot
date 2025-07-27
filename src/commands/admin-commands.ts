import { clearAllPersistentData, clearSession, getSession, saveSession } from "../middleware/session.ts";
import { mainMenu } from "../menus/admin-menu.ts";
import { MESSAGES } from "../constants/messages.ts";
import type { MyContext } from "../middleware/session.ts";

export async function handleStart(ctx: MyContext) {
  const message = await ctx.reply(MESSAGES.MAIN_MENU_TITLE, {
    reply_markup: mainMenu,
    parse_mode: "HTML",
  });
  const session = await getSession(ctx);
  session.lastMenuMessageId = message.message_id;
  await saveSession(ctx, session);
}

export async function handleReset(ctx: MyContext) {
  await clearSession(ctx);
  await ctx.reply(MESSAGES.ADMIN_INTERFACE_RESET, { reply_markup: mainMenu });
}

export async function handleReboot(ctx: MyContext) {
  await clearAllPersistentData();
  await ctx.reply(MESSAGES.REBOOT_SUCCESS, { parse_mode: "HTML" });
}
