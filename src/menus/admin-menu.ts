import { Menu } from "@grammyjs/menu";
import { MyContext } from "../middleware/session.ts";
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
    await ctx.menu.nav("weekly-settings");
  }
};

export const mainMenu = new Menu<MyContext>("main")
  .text(
    MESSAGES.CREATE_POLL,
    (ctx: MyContext) => ctx.menu.nav("poll-create"),
  ).row()
  .text(MESSAGES.CLOSE_POLL, closePoll).row()
  .text(
    MESSAGES.WEEKLY_SETTINGS,
    (ctx: MyContext) => ctx.menu.nav("weekly-settings"),
  );

export const pollCreateMenu: Menu<MyContext> = new Menu<MyContext>(
  "poll-create",
)
  .text(
    async () =>
      MESSAGES.MENU_LABEL_QUESTION(
        (await pollService.getInstantPollConfig()).question,
      ),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_poll_question";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["question"]),
      );
    },
  ).row()
  .text(
    async () =>
      MESSAGES.MENU_LABEL_POSITIVE(
        (await pollService.getInstantPollConfig()).positiveOption,
      ),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_poll_positiveOption";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["positiveOption"]),
      );
    },
  ).row()
  .text(
    async () =>
      MESSAGES.MENU_LABEL_NEGATIVE(
        (await pollService.getInstantPollConfig()).negativeOption,
      ),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_poll_negativeOption";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["negativeOption"]),
      );
    },
  ).row()
  .text(
    async () =>
      MESSAGES.MENU_LABEL_TARGET(
        (await pollService.getInstantPollConfig()).targetVotes,
      ),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_poll_targetVotes";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["targetVotes"]),
      );
    },
  ).row()
  .text(MESSAGES.MENU_REFRESH, (ctx: MyContext) => {
    ctx.menu.update();
  }).row()
  .text(MESSAGES.MENU_CREATE, confirmPoll)
  .text(MESSAGES.MENU_BACK, async (ctx: MyContext) => {
    ctx.session.routeState = "main_menu";
    await ctx.reply(MESSAGES.CANCELLED, { parse_mode: "MarkdownV2" });
    ctx.menu.nav("main");
  });

const weeklySettingsMenuInst: Menu<MyContext> = new Menu<MyContext>(
  "weekly-settings",
)
  .text(
    async () =>
      MESSAGES.MENU_LABEL_QUESTION(
        (await pollService.getWeeklyConfig()).question,
      ),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_weekly_question";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["question"]),
      );
    },
  ).row()
  .text(
    async () =>
      MESSAGES.MENU_LABEL_POSITIVE(
        (await pollService.getWeeklyConfig()).positiveOption,
      ),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_weekly_positiveOption";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["positiveOption"]),
      );
    },
  ).row()
  .text(
    async () =>
      MESSAGES.MENU_LABEL_NEGATIVE(
        (await pollService.getWeeklyConfig()).negativeOption,
      ),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_weekly_negativeOption";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["negativeOption"]),
      );
    },
  ).row()
  .text(
    async () =>
      MESSAGES.MENU_LABEL_TARGET(
        (await pollService.getWeeklyConfig()).targetVotes,
      ),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_weekly_targetVotes";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["targetVotes"]),
      );
    },
  ).row()
  .text(
    async () =>
      MESSAGES.MENU_LABEL_DAY(
        DAYS[(await pollService.getWeeklyConfig()).dayOfWeek],
      ),
    (ctx: MyContext) => ctx.menu.nav("day-selector"),
  ).row()
  .text(
    async () =>
      MESSAGES.MENU_LABEL_TIME((await pollService.getWeeklyConfig()).startHour),
    async (ctx: MyContext) => {
      ctx.session.routeState = "edit_weekly_startHour";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["startHour"]),
      );
    },
  ).row()
  .text(async () => {
    const minutes = (await pollService.getWeeklyConfig()).randomWindowMinutes ||
      0;
    return `🎲 Випадковість: ${
      minutes === 0
        ? MESSAGES.MENU_RANDOM_OFF
        : MESSAGES.MENU_RANDOM_MINUTES(minutes)
    }`;
  }, async (ctx: MyContext) => {
    ctx.session.routeState = "edit_weekly_randomWindowMinutes";
    await ctx.reply(
      MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["randomWindowMinutes"]),
    );
  }).row()
  .text(async () => {
    const config = await pollService.getWeeklyConfig();
    const planned = config.enabled && await getNextPollTime();
    let label = planned ? MESSAGES.MENU_ENABLED : MESSAGES.MENU_DISABLED;
    if (planned) {
      label += ` (${
        planned.toLocaleString("uk-UA", { timeZone: "Europe/Kiev" })
      })`;
    }
    return label;
  }, toggleWeeklyStatus).row()
  .text(MESSAGES.MENU_REFRESH, (ctx: MyContext) => {
    ctx.menu.update();
  }).row()
  .text(MESSAGES.MENU_BACK, async (ctx: MyContext) => {
    ctx.session.routeState = "weekly-settings";
    await ctx.reply(MESSAGES.CANCELLED, { parse_mode: "MarkdownV2" });
    ctx.menu.nav("main");
  });

export const weeklySettingsMenu = weeklySettingsMenuInst;

export const daySelectorMenu = (() => {
  let menu = new Menu<MyContext>("day-selector");
  Object.entries(DAYS).forEach(([index, day]) => {
    menu = menu.text(day, daySelection(parseInt(index))).row();
  });
  menu = menu.text(
    MESSAGES.MENU_BACK,
    (ctx: MyContext) => ctx.menu.nav("weekly-settings"),
  );
  return menu;
})();

weeklySettingsMenuInst.register(daySelectorMenu);

mainMenu.register(pollCreateMenu);
mainMenu.register(weeklySettingsMenuInst);
