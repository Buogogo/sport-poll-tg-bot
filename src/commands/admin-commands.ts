import {
  clearAllPersistentData,
  getAdminSession,
  resetSession,
} from "../middleware/session.ts";
import { mainMenu } from "../menus/admin-menu.ts";
import { MESSAGES } from "../constants/messages.ts";
import type { MyContext } from "../middleware/session.ts";

export async function handleStart(ctx: MyContext) {
  const { reply } = ctx;
  const session = getAdminSession(ctx);
  const message = await reply(MESSAGES.MAIN_MENU_TITLE, {
    reply_markup: mainMenu,
    parse_mode: "HTML",
  });
  session.lastMenuMessageId = message.message_id;
}

export async function handleReset(ctx: MyContext) {
  const { reply } = ctx;
  resetSession(ctx);
  await reply(MESSAGES.ADMIN_INTERFACE_RESET, { reply_markup: mainMenu });
}

export async function handleReboot(ctx: MyContext) {
  const { reply } = ctx;
  await clearAllPersistentData();
  await reply(MESSAGES.REBOOT_SUCCESS, { parse_mode: "HTML" });
}
