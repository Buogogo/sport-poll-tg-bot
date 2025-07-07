import { MESSAGES } from "../constants/messages.ts";
import { validateField } from "../utils/validation.ts";

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const parseVoteCommand = (
  text: string,
): { names?: string[]; count?: number } => {
  if (!text.startsWith("/plus")) {
    throw new ValidationError(MESSAGES.INVALID_COMMAND_PLUS);
  }
  const args = text.substring(5).trim();
  if (!args) return { count: 1 };

  const numberMatch = args.match(/^\d+$/);
  if (numberMatch) {
    const count = validateField("voteCount", args) as number;
    return { count };
  }

  const names = args.split(",").map((name) => name.trim()).filter((name) =>
    name.length > 0
  );
  if (names.length === 0) throw new ValidationError(MESSAGES.EMPTY_NAMES);
  if (names.length > 10) throw new ValidationError(MESSAGES.TOO_MANY_NAMES);

  for (const name of names) {
    validateField("userName", name);
    if (!/^[\p{L}\p{N}\s._-]+$/u.test(name)) {
      throw new ValidationError(MESSAGES.INVALID_NAME_CHARS);
    }
  }
  return { names };
};

export const parseRevokeCommand = (text: string): number => {
  if (!text.startsWith("/minus")) {
    throw new ValidationError(MESSAGES.INVALID_COMMAND_MINUS);
  }
  const args = text.substring(6).trim();
  if (!args) throw new ValidationError(MESSAGES.VOTE_NUMBER_NOT_PROVIDED);

  const numberMatch = args.match(/^\d+$/);
  if (!numberMatch) {
    throw new ValidationError(MESSAGES.INVALID_VOTE_NUMBER_FORMAT);
  }

  return validateField("voteNumber", args) as number;
};
