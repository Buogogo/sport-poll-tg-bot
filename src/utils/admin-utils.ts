import { getConfig } from "../services/bot.ts";

export function isAdmin(userId: number): boolean {
  const { adminUserIds } = getConfig();
  return adminUserIds.includes(userId);
}
