import { getConfig } from "../services/bot.ts";
import { MESSAGES } from "../constants/messages.ts";

// Simple error for utils that don't have context
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const parseVoteCommand = (
  text: string,
): { names?: string[]; count?: number } => {
  if (!text.startsWith("/+")) {
    throw new ValidationError(MESSAGES.INVALID_COMMAND_PLUS);
  }
  const args = text.substring(2).trim();
  if (!args) return { count: 1 }; // Default to 1 anonymous vote for just "/+"
  const numberMatch = args.match(/^\d+$/);
  if (numberMatch) {
    const count = parseInt(args, 10);
    if (count <= 0 || count > 20) {
      throw new ValidationError(MESSAGES.INVALID_VOTE_COUNT);
    }
    return { count };
  }
  const names = args
    .split(/[,\s]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  if (names.length === 0) {
    throw new ValidationError(MESSAGES.EMPTY_NAMES);
  }
  if (names.length > 10) {
    throw new ValidationError(MESSAGES.TOO_MANY_NAMES);
  }
  for (const name of names) {
    if (name.length > 50) {
      throw new ValidationError(MESSAGES.NAME_TOO_LONG);
    }
    if (!/^[\p{L}\p{N}\s._-]+$/u.test(name)) {
      throw new ValidationError(MESSAGES.INVALID_NAME_CHARS);
    }
  }
  return { names };
};

export const parseRevokeCommand = (text: string): number => {
  if (!text.startsWith("/-")) {
    throw new ValidationError(MESSAGES.INVALID_COMMAND_MINUS);
  }
  const args = text.substring(2).trim();
  if (!args) throw new ValidationError(MESSAGES.VOTE_NUMBER_NOT_PROVIDED);
  const numberMatch = args.match(/^\d+$/);
  if (!numberMatch) {
    throw new ValidationError(MESSAGES.INVALID_VOTE_NUMBER_FORMAT);
  }
  const voteNumber = parseInt(numberMatch[0], 10);
  if (voteNumber <= 0) {
    throw new ValidationError(MESSAGES.INVALID_VOTE_NUMBER);
  }
  return voteNumber;
};

export const saveJsonFile = async (
  path: string,
  data: unknown,
): Promise<void> => {
  await Deno.mkdir("data", { recursive: true }).catch(() => {});
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2))
    .catch((error) => console.error(`Save error ${path}:`, error));
};

export const loadJsonFile = async <T>(
  path: string,
  defaultValue: T,
): Promise<T> => {
  try {
    const content = await Deno.readTextFile(path);
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
};

export function buildCronExpression(targetTime: Date): string {
  return `${targetTime.getUTCMinutes()} ${targetTime.getUTCHours()} * * ${targetTime.getUTCDay()}`;
}

export function isAdmin(userId: number): boolean {
  const { adminUserIds } = getConfig();
  return adminUserIds.includes(userId);
}
