import { MESSAGES } from "../constants/messages.ts";
import { MyContext } from "../middleware/session.ts";
import { UserFacingError } from "../constants/types.ts";

interface ValidationSchema {
  type: "string" | "number";
  min?: number;
  max?: number;
  message: string;
}

const FIELD_SCHEMAS: Record<string, ValidationSchema> = {
  targetVotes: {
    type: "number",
    min: 1,
    max: 30,
    message: MESSAGES.INVALID_TARGET_VOTES,
  },
  startHour: {
    type: "number",
    min: 0,
    max: 23,
    message: MESSAGES.INVALID_START_HOUR,
  },
  randomWindowMinutes: {
    type: "number",
    min: 0,
    max: 59,
    message: MESSAGES.INVALID_RANDOM_WINDOW,
  },
  question: {
    type: "string",
    min: 3,
    max: 300,
    message: MESSAGES.INVALID_QUESTION_LENGTH,
  },
  positiveOption: {
    type: "string",
    min: 1,
    max: 100,
    message: MESSAGES.INVALID_OPTION_LENGTH,
  },
  negativeOption: {
    type: "string",
    min: 1,
    max: 100,
    message: MESSAGES.INVALID_OPTION_LENGTH,
  },
  voteCount: {
    type: "number",
    min: 1,
    max: 9,
    message: MESSAGES.INVALID_VOTE_COUNT,
  },
  voteNumber: { type: "number", min: 1, message: MESSAGES.INVALID_VOTE_NUMBER },
  userName: {
    type: "string",
    min: 1,
    max: 50,
    message: MESSAGES.NAME_TOO_LONG,
  },
  groupChatId: { type: "number", message: "Invalid group chat ID" },
};

export function validateField(
  ctx: MyContext,
  field: string,
  value: string,
): string | number {
  const schema = FIELD_SCHEMAS[field];
  if (!schema) throw new Error(`Unknown field: ${field}`);

  if (schema.type === "number") {
    const num = parseInt(value.trim(), 10);
    if (isNaN(num)) throw new UserFacingError(ctx, schema.message);
    if (schema.min !== undefined && num < schema.min) {
      throw new UserFacingError(ctx, schema.message);
    }
    if (schema.max !== undefined && num > schema.max) {
      throw new UserFacingError(ctx, schema.message);
    }
    return num;
  }

  const trimmed = value.trim();
  if (schema.min !== undefined && trimmed.length < schema.min) {
    throw new UserFacingError(ctx, schema.message);
  }
  if (schema.max !== undefined && trimmed.length > schema.max) {
    throw new UserFacingError(ctx, schema.message);
  }
  return trimmed;
}
