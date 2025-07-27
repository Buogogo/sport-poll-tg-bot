import { MyContext, getSession, saveSession } from "../middleware/session.ts";
import * as pollService from "../services/poll-service.ts";
import { MESSAGES } from "../constants/messages.ts";
import { validateField } from "./validation.ts";

const EDIT_CONFIG = {
  edit_poll_question: { field: "question", config: "instant" },
  edit_poll_positiveOption: { field: "positiveOption", config: "instant" },
  edit_poll_negativeOption: { field: "negativeOption", config: "instant" },
  edit_poll_targetVotes: { field: "targetVotes", config: "instant" },
  edit_weekly_question: { field: "question", config: "weekly" },
  edit_weekly_positiveOption: { field: "positiveOption", config: "weekly" },
  edit_weekly_negativeOption: { field: "negativeOption", config: "weekly" },
  edit_weekly_targetVotes: { field: "targetVotes", config: "weekly" },
  edit_weekly_startHour: { field: "startHour", config: "weekly" },
  edit_weekly_randomWindowMinutes: { field: "randomWindowMinutes", config: "weekly" },
} as const;

export const handleEditMessage = async (ctx: MyContext, editMode: string) => {
  const text = ctx.message?.text;
  if (typeof text !== "string") {
    await ctx.reply(MESSAGES.DEFAULT_ERROR);
    return;
  }

  const config = EDIT_CONFIG[editMode as keyof typeof EDIT_CONFIG];
  if (!config) {
    await ctx.reply(MESSAGES.DEFAULT_ERROR);
    const session = await getSession(ctx);
    session.editMode = undefined;
    await saveSession(ctx, session);
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

    const session = await getSession(ctx);
    session.editMode = undefined;
    await saveSession(ctx, session);
    await ctx.reply(MESSAGES.FIELD_SAVED);
  } catch (error) {
    const message = error instanceof Error ? error.message : MESSAGES.DEFAULT_ERROR;
    await ctx.reply(message);
  }
};
