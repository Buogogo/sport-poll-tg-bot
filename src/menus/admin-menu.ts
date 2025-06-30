import { Menu } from "@grammyjs/menu";
import { MyContext } from "../middleware/session.ts";
import { DAYS, MESSAGES } from "../constants/messages.ts";
import { getNextPollTime } from "../services/scheduler.ts";
import * as pollService from "../services/poll-service.ts";

const closePoll = async (ctx: MyContext) => {
  const result = pollService.closePollLogic();
  await ctx.answerCallbackQuery(result.message);
};

const confirmPoll = async (ctx: MyContext) => {
  const result = await pollService.confirmPollLogic();
  await ctx.answerCallbackQuery(result.message);
  if (ctx.menu) {
    ctx.menu.nav("main");
  }
  ctx.menu.update();
};

const toggleWeeklyStatus = async (ctx: MyContext) => {
  const config = pollService.getWeeklyConfig();
  const newEnabled = !config.enabled;
  pollService.setWeeklyConfig({ enabled: newEnabled });
  await ctx.answerCallbackQuery(
    newEnabled ? MESSAGES.WEEKLY_ENABLED : MESSAGES.WEEKLY_DISABLED,
  );
  ctx.menu.update();
};

const daySelection = (dayIndex: number) => async (ctx: MyContext) => {
  pollService.setWeeklyConfig({ dayOfWeek: dayIndex });
  await ctx.answerCallbackQuery(MESSAGES.DAY_SAVED);
  if (ctx.menu) {
    ctx.menu.nav("weekly-settings");
  }
  ctx.menu.update();
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
    () =>
      MESSAGES.MENU_LABEL_QUESTION(pollService.getInstantPollConfig().question),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "question";
      ctx.session.editContext = "poll";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["question"]),
      );
    },
  ).row()
  .text(
    () =>
      MESSAGES.MENU_LABEL_POSITIVE(
        pollService.getInstantPollConfig().positiveOption,
      ),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "positiveOption";
      ctx.session.editContext = "poll";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["positiveOption"]),
      );
    },
  ).row()
  .text(
    () =>
      MESSAGES.MENU_LABEL_NEGATIVE(
        pollService.getInstantPollConfig().negativeOption,
      ),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "negativeOption";
      ctx.session.editContext = "poll";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["negativeOption"]),
      );
    },
  ).row()
  .text(
    () =>
      MESSAGES.MENU_LABEL_TARGET(
        pollService.getInstantPollConfig().targetVotes,
      ),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "targetVotes";
      ctx.session.editContext = "poll";
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
    if (ctx.session.editTarget) {
      ctx.session.editTarget = undefined;
      ctx.session.editContext = undefined;
      await ctx.reply("Скасовано");
    }
    ctx.menu.nav("main");
  });

const weeklySettingsMenuInst: Menu<MyContext> = new Menu<MyContext>(
  "weekly-settings",
)
  .text(
    () => MESSAGES.MENU_LABEL_QUESTION(pollService.getWeeklyConfig().question),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "question";
      ctx.session.editContext = "weekly";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["question"]),
      );
    },
  ).row()
  .text(
    () =>
      MESSAGES.MENU_LABEL_POSITIVE(
        pollService.getWeeklyConfig().positiveOption,
      ),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "positiveOption";
      ctx.session.editContext = "weekly";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["positiveOption"]),
      );
    },
  ).row()
  .text(
    () =>
      MESSAGES.MENU_LABEL_NEGATIVE(
        pollService.getWeeklyConfig().negativeOption,
      ),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "negativeOption";
      ctx.session.editContext = "weekly";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["negativeOption"]),
      );
    },
  ).row()
  .text(
    () => MESSAGES.MENU_LABEL_TARGET(pollService.getWeeklyConfig().targetVotes),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "targetVotes";
      ctx.session.editContext = "weekly";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["targetVotes"]),
      );
    },
  ).row()
  .text(
    () =>
      MESSAGES.MENU_LABEL_DAY(
        DAYS[pollService.getWeeklyConfig().dayOfWeek] || "???",
      ),
    (ctx: MyContext) => ctx.menu.nav("day-selector"),
  ).row()
  .text(
    () => MESSAGES.MENU_LABEL_TIME(pollService.getWeeklyConfig().startHour),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "startHour";
      ctx.session.editContext = "weekly";
      await ctx.reply(
        MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["startHour"]),
      );
    },
  ).row()
  .text(() => {
    const minutes = pollService.getWeeklyConfig().randomWindowMinutes || 0;
    return `🎲 Випадковість: ${
      minutes === 0
        ? MESSAGES.MENU_RANDOM_OFF
        : MESSAGES.MENU_RANDOM_MINUTES(minutes)
    }`;
  }, async (ctx: MyContext) => {
    ctx.session.editTarget = "randomWindowMinutes";
    ctx.session.editContext = "weekly";
    await ctx.reply(
      MESSAGES.ENTER_FIELD_PROMPT(MESSAGES.FIELD_NAMES["randomWindowMinutes"]),
    );
  }).row()
  .text(() => {
    const config = pollService.getWeeklyConfig();
    const planned = config.enabled && getNextPollTime();
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
    if (ctx.session.editTarget) {
      ctx.session.editTarget = undefined;
      ctx.session.editContext = undefined;
      await ctx.reply("Скасовано");
    }
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
