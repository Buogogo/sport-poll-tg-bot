import { MiddlewareFn } from "grammy";
import { MyContext } from "../middleware/session.ts";
import * as pollService from "../services/poll-service.ts";
import { MESSAGES } from "../constants/messages.ts";
import { validateField } from "./validation.ts";

export const EDIT_PAGES = [
  "edit_poll_question",
  "edit_poll_positiveOption",
  "edit_poll_negativeOption",
  "edit_poll_targetVotes",
  "edit_weekly_question",
  "edit_weekly_positiveOption",
  "edit_weekly_negativeOption",
  "edit_weekly_targetVotes",
  "edit_weekly_startHour",
  "edit_weekly_randomWindowMinutes",
] as const;

export type EditPage = typeof EDIT_PAGES[number];

const EDIT_CONFIG = {
  edit_poll_question: {
    field: "question",
    config: "instant",
    route: "poll-create",
  },
  edit_poll_positiveOption: {
    field: "positiveOption",
    config: "instant",
    route: "poll-create",
  },
  edit_poll_negativeOption: {
    field: "negativeOption",
    config: "instant",
    route: "poll-create",
  },
  edit_poll_targetVotes: {
    field: "targetVotes",
    config: "instant",
    route: "poll-create",
  },
  edit_weekly_question: {
    field: "question",
    config: "weekly",
    route: "weekly-settings",
  },
  edit_weekly_positiveOption: {
    field: "positiveOption",
    config: "weekly",
    route: "weekly-settings",
  },
  edit_weekly_negativeOption: {
    field: "negativeOption",
    config: "weekly",
    route: "weekly-settings",
  },
  edit_weekly_targetVotes: {
    field: "targetVotes",
    config: "weekly",
    route: "weekly-settings",
  },
  edit_weekly_startHour: {
    field: "startHour",
    config: "weekly",
    route: "weekly-settings",
  },
  edit_weekly_randomWindowMinutes: {
    field: "randomWindowMinutes",
    config: "weekly",
    route: "weekly-settings",
  },
} as const;

export const handleEditMessage: MiddlewareFn<MyContext> = async (
  ctx,
  _next,
) => {
  const { routeState } = ctx.session;
  const editPage = routeState as EditPage;
  const text = ctx.message?.text;
  if (typeof text !== "string") {
    await ctx.reply(MESSAGES.DEFAULT_ERROR);
    return;
  }

  const config = EDIT_CONFIG[editPage];
  if (!config) {
    await ctx.reply(MESSAGES.DEFAULT_ERROR);
    ctx.session.routeState = undefined;
    return;
  }

  try {
    const validatedValue = validateField(ctx, config.field, text.trim());
    const updateData = { [config.field]: validatedValue };

    if (config.config === "instant") {
      await pollService.setInstantPollConfig(updateData);
    } else {
      await pollService.setWeeklyConfig(updateData);
    }

    ctx.session.routeState = config.route;
    await ctx.reply(MESSAGES.FIELD_SAVED);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : MESSAGES.DEFAULT_ERROR;
    await ctx.reply(message);
  }
};
