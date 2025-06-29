import { Menu } from "@grammyjs/menu";
import { createConversation } from "@grammyjs/conversations";
import type { Conversation } from "@grammyjs/conversations";
import { MyContext } from "../middleware/session.ts";
import { DAYS, MESSAGES } from "../constants/messages.ts";
import {
  clearSchedule,
  getNextPollTime,
  schedulePoll,
} from "../services/scheduler.ts";
import { UserFacingError } from "../constants/types.ts";
import * as pollService from "../services/poll-service.ts";

const validateNumericField = (
  target: string,
  value: string,
  ctx: MyContext,
): number => {
  const parsedValue = parseInt(value, 10);
  switch (target) {
    case "targetVotes":
      if (isNaN(parsedValue) || parsedValue < 1 || parsedValue > 9) {
        throw new UserFacingError(ctx, MESSAGES.INVALID_TARGET_VOTES);
      }
      break;
    case "startHour":
      if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 23) {
        throw new UserFacingError(ctx, MESSAGES.INVALID_START_HOUR);
      }
      break;
    case "randomWindowMinutes":
      if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 59) {
        throw new UserFacingError(ctx, MESSAGES.INVALID_RANDOM_WINDOW);
      }
      break;
    default:
      throw new UserFacingError(ctx, MESSAGES.UNKNOWN_NUMERIC_FIELD(target));
  }
  return parsedValue;
};

const validateStringField = (
  target: string,
  value: string,
  ctx: MyContext,
): string => {
  if (target === "question" && (value.length < 3 || value.length > 300)) {
    throw new UserFacingError(ctx, MESSAGES.INVALID_QUESTION_LENGTH);
  }
  if (
    (target === "positiveOption" || target === "negativeOption") &&
    (value.length < 1 || value.length > 100)
  ) {
    throw new UserFacingError(ctx, MESSAGES.INVALID_OPTION_LENGTH);
  }
  return value;
};

const validateField = (
  target: string,
  value: string,
  ctx: MyContext,
): string | number => {
  const numericFields = ["targetVotes", "startHour", "randomWindowMinutes"];
  if (numericFields.includes(target)) {
    return validateNumericField(target, value, ctx);
  }
  return validateStringField(target, value, ctx);
};

// Reusable helper for conversational retries
async function getValidInput<T>(
  conversation: Conversation<MyContext>,
  validate: (text: string) => T,
): Promise<T> {
  while (true) {
    const { message } = await conversation.wait();
    return validate(message!.text!.trim());
  }
}

// Context setter map for extensibility
const contextSetters: Record<
  string,
  (target: string, value: string | number, ctx: MyContext) => Promise<void>
> = {
  poll: async (target, value) =>
    await pollService.setInstantPollConfig({ [target]: value }),
  weekly: async (target, value) => {
    await pollService.setWeeklyConfig({ [target]: value });
    const config = pollService.getWeeklyConfig();
    if (config.enabled) {
      schedulePoll();
    } else {
      clearSchedule();
    }
  },
  // Add more contexts here as needed
};

async function editFieldConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const target = ctx.session.editTarget!;
  const context = ctx.session.editContext!;
  const fieldName = MESSAGES.FIELD_NAMES[target];
  await ctx.reply(MESSAGES.ENTER_FIELD_PROMPT(fieldName));
  const validatedValue = await getValidInput(
    conversation,
    (text) => validateField(target, text, ctx),
  );
  await setFieldValue(context, target, validatedValue, ctx);
  await ctx.reply(MESSAGES.FIELD_SAVED);
}

async function setFieldValue(
  context: string,
  target: string,
  value: string | number,
  ctx: MyContext,
) {
  const setter = contextSetters[context];
  if (!setter) throw new Error(MESSAGES.UNKNOWN_CONTEXT(context));
  await setter(target, value, ctx);
}

export const editFieldConv = createConversation(
  editFieldConversation,
  "editField",
);

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
  const enabled = !!config.enabled;
  await pollService.setWeeklyConfig({ enabled: !enabled });
  if (!enabled) {
    schedulePoll();
  } else {
    clearSchedule();
  }
  await ctx.answerCallbackQuery(
    enabled ? MESSAGES.WEEKLY_DISABLED : MESSAGES.WEEKLY_ENABLED,
  );
  ctx.menu.update();
};

const daySelection = (dayIndex: number) => async (ctx: MyContext) => {
  pollService.setWeeklyConfig({ dayOfWeek: dayIndex });
  schedulePoll();
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
      await ctx.conversation.enter("editField");
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
      await ctx.conversation.enter("editField");
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
      await ctx.conversation.enter("editField");
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
      await ctx.conversation.enter("editField");
    },
  ).row()
  .text(MESSAGES.MENU_REFRESH, (ctx: MyContext) => {
    ctx.menu.update();
  }).row()
  .text(MESSAGES.MENU_CREATE, confirmPoll)
  .text(MESSAGES.MENU_BACK, (ctx: MyContext) => ctx.menu.nav("main"));

const weeklySettingsMenuInst: Menu<MyContext> = new Menu<MyContext>(
  "weekly-settings",
)
  .text(
    () => MESSAGES.MENU_LABEL_QUESTION(pollService.getWeeklyConfig().question),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "question";
      ctx.session.editContext = "weekly";
      await ctx.conversation.enter("editField");
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
      await ctx.conversation.enter("editField");
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
      await ctx.conversation.enter("editField");
    },
  ).row()
  .text(
    () => MESSAGES.MENU_LABEL_TARGET(pollService.getWeeklyConfig().targetVotes),
    async (ctx: MyContext) => {
      ctx.session.editTarget = "targetVotes";
      ctx.session.editContext = "weekly";
      await ctx.conversation.enter("editField");
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
      await ctx.conversation.enter("editField");
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
    await ctx.conversation.enter("editField");
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
  .text(MESSAGES.MENU_BACK, (ctx: MyContext) => ctx.menu.nav("main"));

export const weeklySettingsMenu = weeklySettingsMenuInst;

export let daySelectorMenu = new Menu<MyContext>("day-selector");
Object.entries(DAYS).forEach(([index, day]) => {
  daySelectorMenu = daySelectorMenu.text(day, daySelection(parseInt(index)))
    .row();
});
daySelectorMenu = daySelectorMenu.text(
  MESSAGES.MENU_BACK,
  (ctx: MyContext) => ctx.menu.nav("weekly-settings"),
);

mainMenu.register(pollCreateMenu);
mainMenu.register(weeklySettingsMenuInst);
weeklySettingsMenuInst.register(daySelectorMenu);
