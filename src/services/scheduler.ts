import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);
import * as pollService from "./poll-service.ts";
import { logger } from "../utils/logger.ts";
import { appEvt } from "../events/events.ts";
import { setWeeklyConfig } from "./poll-service.ts";

export async function getNextPollTime(): Promise<Date | null> {
  const config = await pollService.getWeeklyConfig();
  const { nextPollTime } = config;
  return nextPollTime ? new Date(nextPollTime) : null;
}

export async function calculateNextPollTime(
  forNextWeek = false,
  baseDate?: Date,
): Promise<Date> {
  const config = await pollService.getWeeklyConfig();
  const { dayOfWeek, startHour } = config;
  const tenMinuteSlots = [0, 10, 20, 30, 40, 50];
  const minute =
    tenMinuteSlots[Math.floor(Math.random() * tenMinuteSlots.length)];
  const base = baseDate
    ? dayjs(baseDate).tz("Europe/Kiev")
    : dayjs().tz("Europe/Kiev");
  let poll = base.day(dayOfWeek).hour(startHour).minute(minute).second(0)
    .millisecond(0);
  if (forNextWeek || poll.isBefore(base)) poll = poll.add(1, "week");
  return poll.utc().toDate();
}

export function logNextPollTime(time: Date) {
  const localTime = dayjs(time).tz("Europe/Kiev").format();
  logger.info(
    `Next poll scheduled for: ${time.toISOString()} (UTC), ${localTime} (Kyiv)`,
  );
}

export async function createOrReplaceWeeklyPoll(): Promise<void> {
  logger.info("Creating or replacing weekly poll...");
  const { question, positiveOption, negativeOption, targetVotes } =
    await pollService.createWeeklyPoll();
  await pollService.startPoll(
    question,
    positiveOption,
    negativeOption,
    targetVotes,
  );
  logger.info("Poll created.");
}

export async function initializeScheduler(): Promise<void> {
  const config = await pollService.getWeeklyConfig();
  if (!config.enabled) {
    return;
  }
  let shouldPost = false;
  if (!config.nextPollTime) {
    const nextTime = await calculateNextPollTime();
    config.nextPollTime = nextTime.toISOString();
    await pollService.setWeeklyConfig(config);
  } else {
    const now = new Date();
    const scheduled = new Date(config.nextPollTime);
    if (now >= scheduled) {
      shouldPost = true;
    }
  }
  if (shouldPost) {
    await createOrReplaceWeeklyPoll();
    const nextTime = await calculateNextPollTime();
    const config = await pollService.getWeeklyConfig();
    config.nextPollTime = nextTime.toISOString();
    await pollService.setWeeklyConfig(config);
  }
}

Deno.cron("Check and trigger weekly poll", "*/10 * * * *", async () => {
  const config = await pollService.getWeeklyConfig();
  if (!config.enabled || !config.nextPollTime) return;
  const now = new Date();
  const scheduled = new Date(config.nextPollTime);
  if (now >= scheduled) {
    logger.info("[cron] Time to post the weekly poll!");
    await createOrReplaceWeeklyPoll();
    const nextTime = await calculateNextPollTime(true, scheduled);
    const config = await pollService.getWeeklyConfig();
    config.nextPollTime = nextTime.toISOString();
    await pollService.setWeeklyConfig(config);
  }
});

export async function scheduleNextPoll(
  { forNextWeek } = { forNextWeek: false },
): Promise<void> {
  const nextPollTime = await calculateNextPollTime(forNextWeek);
  await setWeeklyConfig({
    nextPollTime: nextPollTime.toISOString(),
  });
  appEvt.post({ type: "poll_scheduled", nextPollTime });
}
