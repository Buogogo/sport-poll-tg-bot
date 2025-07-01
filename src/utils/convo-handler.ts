import { MiddlewareFn } from "grammy";
import { MyContext } from "../middleware/session.ts";
import * as pollService from "../services/poll-service.ts";
import { MESSAGES } from "../constants/messages.ts";

const validateNumericField = (
  target: string,
  value: string,
): number => {
  const parsedValue = parseInt(value, 10);
  switch (target) {
    case "targetVotes":
      if (isNaN(parsedValue) || parsedValue < 1 || parsedValue > 9) {
        throw new Error(MESSAGES.INVALID_TARGET_VOTES);
      }
      break;
    case "startHour":
      if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 23) {
        throw new Error(MESSAGES.INVALID_START_HOUR);
      }
      break;
    case "randomWindowMinutes":
      if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 59) {
        throw new Error(MESSAGES.INVALID_RANDOM_WINDOW);
      }
      break;
    default:
      throw new Error(MESSAGES.UNKNOWN_NUMERIC_FIELD(target));
  }
  return parsedValue;
};

const validateStringField = (
  target: string,
  value: string,
): string => {
  if (target === "question" && (value.length < 3 || value.length > 300)) {
    throw new Error(MESSAGES.INVALID_QUESTION_LENGTH);
  }
  if (
    (target === "positiveOption" || target === "negativeOption") &&
    (value.length < 1 || value.length > 100)
  ) {
    throw new Error(MESSAGES.INVALID_OPTION_LENGTH);
  }
  return value;
};

const validateField = (
  target: string,
  value: string,
): string | number => {
  const numericFields = ["targetVotes", "startHour", "randomWindowMinutes"];
  if (numericFields.includes(target)) {
    return validateNumericField(target, value);
  }
  return validateStringField(target, value);
};

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

export const handleEditMessage: MiddlewareFn<MyContext> = async (ctx, next) => {
  const { routeState } = ctx.session;
  if (routeState && routeState.startsWith("edit_")) {
    const text = ctx.message?.text;
    if (typeof text !== "string") {
      await ctx.reply(MESSAGES.DEFAULT_ERROR);
      return;
    }
    const value = text.trim();
    let target: string | undefined;
    let context: "poll" | "weekly" | undefined;
    // Parse routeState, e.g. "edit_poll_question" => ["edit", "poll", "question"]
    const parts = routeState.split("_");
    if (parts.length === 3) {
      context = parts[1] as "poll" | "weekly";
      target = parts[2];
    }
    if (!target || !context) {
      await ctx.reply(MESSAGES.DEFAULT_ERROR);
      ctx.session.routeState = undefined;
      return;
    }
    const validatedValue = validateField(target, value);
    if (context === "poll") {
      await pollService.setInstantPollConfig({ [target]: validatedValue });
      ctx.session.routeState = "poll-create";
    } else if (context === "weekly") {
      await pollService.setWeeklyConfig({ [target]: validatedValue });
      ctx.session.routeState = "weekly-settings";
    }
    await ctx.reply(MESSAGES.FIELD_SAVED);
    return;
  }
  await next();
};
