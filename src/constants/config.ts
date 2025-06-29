import {
  Config,
  InstantPollConfig,
  PollState,
  WeeklyConfig,
} from "../constants/types.ts";

const getRequiredEnv = (key: string): string => {
  const value = Deno.env.get(key)?.trim();
  if (!value) throw new Error(`${key} environment variable is required`);
  return value;
};

const parseUserIds = (userIdsStr: string): number[] =>
  userIdsStr.split(",").map((id) => {
    const parsed = parseInt(id.trim(), 10);
    if (isNaN(parsed)) throw new Error(`Invalid user ID: ${id.trim()}`);
    return parsed;
  });

export const DEFAULT_POLL_STATE: Omit<
  PollState,
  "directVotes" | "externalVotes"
> = {
  isActive: false,
  question: "",
  positiveOption: "",
  negativeOption: "",
  targetVotes: 0,
  votes: [],
};

export const DEFAULT_WEEKLY_CONFIG: WeeklyConfig = {
  enabled: true,
  question: "Йдемо грати в футбол цього тижня?",
  positiveOption: "Так, йду!",
  negativeOption: "Ні, не можу",
  targetVotes: 12,
  dayOfWeek: 4, // 1=Monday, 7=Sunday
  startHour: 13,
  randomWindowMinutes: 60,
};

export const DEFAULT_INSTANT_POLL_CONFIG: InstantPollConfig = {
  question: "Йдемо грати в футбол цього тижня?",
  positiveOption: "Так, йду!",
  negativeOption: "Ні, не можу",
  targetVotes: 12,
};

export const loadEnvs = (): Config => {
  const botToken = getRequiredEnv("BOT_TOKEN");
  const adminUserIds = parseUserIds(getRequiredEnv("ADMIN_USER_IDS"));
  const targetGroupChatId = parseInt(
    getRequiredEnv("TARGET_GROUP_CHAT_ID"),
    10,
  );
  return { botToken, adminUserIds, targetGroupChatId };
};

export function migrateWeeklyConfig(config: WeeklyConfig): WeeklyConfig {
  if (config.dayOfWeek >= 1 && config.dayOfWeek <= 7) {
    const dow = config.dayOfWeek === 7 ? 0 : config.dayOfWeek;
    return { ...config, dayOfWeek: dow };
  }
  return config;
}
