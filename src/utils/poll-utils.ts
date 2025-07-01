import { WeeklyConfig } from "../constants/types.ts";

export function migrateWeeklyConfig(config: WeeklyConfig): WeeklyConfig {
  if (config.dayOfWeek >= 1 && config.dayOfWeek <= 7) {
    const dow = config.dayOfWeek === 7 ? 0 : config.dayOfWeek;
    return { ...config, dayOfWeek: dow };
  }
  return config;
}
