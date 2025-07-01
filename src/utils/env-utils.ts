export const getRequiredEnv = (key: string): string => {
  const value = Deno.env.get(key)?.trim();
  if (!value) throw new Error(`${key} environment variable is required`);
  return value;
};

export const parseUserIds = (userIdsStr: string): number[] =>
  userIdsStr.split(",").map((id) => {
    const parsed = parseInt(id.trim(), 10);
    if (isNaN(parsed)) throw new Error(`Invalid user ID: ${id.trim()}`);
    return parsed;
  });

export const loadEnvs = (): import("../constants/types.ts").Config => {
  const botToken = getRequiredEnv("BOT_TOKEN");
  const adminUserIds = parseUserIds(getRequiredEnv("ADMIN_USER_IDS"));
  const targetGroupChatId = parseInt(
    getRequiredEnv("TARGET_GROUP_CHAT_ID"),
    10,
  );
  return { botToken, adminUserIds, targetGroupChatId };
};
