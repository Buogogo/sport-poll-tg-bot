import { Menu } from "@grammyjs/menu";
import { MyContext, getSession, saveSession } from "../middleware/session.ts";
import { DAYS, MESSAGES } from "../constants/messages.ts";
import { getNextPollTime } from "../services/scheduler.ts";
import * as pollService from "../services/poll-service.ts";

const closePoll = async (ctx: MyContext) => {
  const result = await pollService.closePollLogic();
  await ctx.answerCallbackQuery(result.message);
};

const confirmPoll = async (ctx: MyContext) => {
  const result = await pollService.confirmPollLogic();
  await ctx.answerCallbackQuery(result.message);
};

const updateStatus = async (ctx: MyContext) => {
  try {
    await pollService.updateStatusMessage();
    await ctx.answerCallbackQuery(MESSAGES.STATUS_UPDATED);
  } catch (error) {
    console.error("Error updating status:", error);
    await ctx.answerCallbackQuery("❌ Помилка оновлення статусу");
  }
};

const toggleWeeklyStatus = async (ctx: MyContext) => {
  const config = await pollService.getWeeklyConfig();
  const newEnabled = !config.enabled;
  await pollService.setWeeklyConfig({ enabled: newEnabled });
  await ctx.answerCallbackQuery(
    newEnabled ? MESSAGES.WEEKLY_ENABLED : MESSAGES.WEEKLY_DISABLED,
  );
  ctx.menu.update();
};

const daySelection = (dayIndex: number) => async (ctx: MyContext) => {
  await pollService.setWeeklyConfig({ dayOfWeek: dayIndex });
  await ctx.answerCallbackQuery(MESSAGES.DAY_SAVED);
  if (ctx.menu) {
    ctx.menu.nav("weekly-settings");
  }
};

const setEditMode = (editMode: string) => async (ctx: MyContext) => {
  const session = await getSession(ctx);
  session.editMode = editMode;
  await saveSession(ctx, session);
  const fieldName = MESSAGES.FIELD_NAMES[editMode.split('_')[2] as keyof typeof MESSAGES.FIELD_NAMES];
  await ctx.reply(MESSAGES.ENTER_FIELD_PROMPT(fieldName));
};

export const mainMenu = new Menu<MyContext>("main")
  .text(MESSAGES.CREATE_POLL, (ctx: MyContext) => ctx.menu.nav("poll-create")).row()
  .text(MESSAGES.CLOSE_POLL, closePoll).row()
  .text(MESSAGES.UPDATE_STATUS, updateStatus).row()
  .text(MESSAGES.WEEKLY_SETTINGS, (ctx: MyContext) => ctx.menu.nav("weekly-settings"));

export const pollCreateMenu: Menu<MyContext> = new Menu<MyContext>("poll-create")
  .text(async () => MESSAGES.MENU_LABEL_QUESTION((await pollService.getInstantPollConfig()).question), setEditMode("edit_poll_question")).row()
  .text(async () => MESSAGES.MENU_LABEL_POSITIVE((await pollService.getInstantPollConfig()).positiveOption), setEditMode("edit_poll_positiveOption")).row()
  .text(async () => MESSAGES.MENU_LABEL_NEGATIVE((await pollService.getInstantPollConfig()).negativeOption), setEditMode("edit_poll_negativeOption")).row()
  .text(async () => MESSAGES.MENU_LABEL_TARGET((await pollService.getInstantPollConfig()).targetVotes), setEditMode("edit_poll_targetVotes")).row()
  .text(MESSAGES.MENU_REFRESH, (ctx: MyContext) => { ctx.menu.update(); }).row()
  .text(MESSAGES.MENU_CREATE, confirmPoll)
  .text(MESSAGES.MENU_BACK, (ctx: MyContext) => { ctx.menu.nav("main"); });

const weeklySettingsMenuInst: Menu<MyContext> = new Menu<MyContext>("weekly-settings")
  .text(async () => MESSAGES.MENU_LABEL_QUESTION((await pollService.getWeeklyConfig()).question), setEditMode("edit_weekly_question")).row()
  .text(async () => MESSAGES.MENU_LABEL_POSITIVE((await pollService.getWeeklyConfig()).positiveOption), setEditMode("edit_weekly_positiveOption")).row()
  .text(async () => MESSAGES.MENU_LABEL_NEGATIVE((await pollService.getWeeklyConfig()).negativeOption), setEditMode("edit_weekly_negativeOption")).row()
  .text(async () => MESSAGES.MENU_LABEL_TARGET((await pollService.getWeeklyConfig()).targetVotes), setEditMode("edit_weekly_targetVotes")).row()
  .text(async () => MESSAGES.MENU_LABEL_DAY(DAYS[(await pollService.getWeeklyConfig()).dayOfWeek]), (ctx: MyContext) => ctx.menu.nav("day-selector")).row()
  .text(async () => MESSAGES.MENU_LABEL_TIME((await pollService.getWeeklyConfig()).startHour), setEditMode("edit_weekly_startHour")).row()
  .text(async () => {
    const minutes = (await pollService.getWeeklyConfig()).randomWindowMinutes || 0;
    return `🎲 Випадковість: ${minutes === 0 ? MESSAGES.MENU_RANDOM_OFF : MESSAGES.MENU_RANDOM_MINUTES(minutes)}`;
  }, setEditMode("edit_weekly_randomWindowMinutes")).row()
  .text(async () => {
    const config = await pollService.getWeeklyConfig();
    const planned = config.enabled && await getNextPollTime();
    let label = planned ? MESSAGES.MENU_ENABLED : MESSAGES.MENU_DISABLED;
    if (planned) {
      label += ` (${planned.toLocaleString("uk-UA", { timeZone: "Europe/Kiev" })})`;
    }
    return label;
  }, toggleWeeklyStatus).row()
  .text(MESSAGES.MENU_REFRESH, (ctx: MyContext) => { ctx.menu.update(); }).row()
  .text(MESSAGES.MENU_BACK, (ctx: MyContext) => { ctx.menu.nav("main"); });

export const weeklySettingsMenu = weeklySettingsMenuInst;

export const daySelectorMenu = (() => {
  let menu = new Menu<MyContext>("day-selector");
  Object.entries(DAYS).forEach(([index, day]) => {
    menu = menu.text(day, daySelection(parseInt(index))).row();
  });
  menu = menu.text(MESSAGES.MENU_BACK, (ctx: MyContext) => ctx.menu.nav("weekly-settings"));
  return menu;
})();

weeklySettingsMenuInst.register(daySelectorMenu);
mainMenu.register(pollCreateMenu);
mainMenu.register(weeklySettingsMenuInst);
