import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);
import * as pollService from "./poll-service.ts";
import { schedulerEvt } from "../events/events.ts";
import { logger } from "../utils/logger.ts";

export async function getNextPollTime(): Promise<Date | null> {
  const config = await pollService.getWeeklyConfig();
  const { nextPollTime } = config;
  return nextPollTime ? new Date(nextPollTime) : null;
}

export async function calculateNextPollTime(): Promise<Date> {
  const config = await pollService.getWeeklyConfig();
  const { dayOfWeek, startHour } = config;
  const now = dayjs().tz("Europe/Kiev");
  // Pick a random 10-minute slot
  const tenMinuteSlots = [0, 10, 20, 30, 40, 50];
  const minute =
    tenMinuteSlots[Math.floor(Math.random() * tenMinuteSlots.length)];
  let poll = now.day(dayOfWeek).hour(startHour).minute(minute).second(0)
    .millisecond(0);
  if (poll.isBefore(now)) poll = poll.add(1, "week");
  return poll.utc().toDate();
}

function logNextPollTime(time: Date) {
  const localTime = dayjs(time).tz("Europe/Kiev").format();
  logger.info(
    `Next poll scheduled for: ${time.toISOString()} (UTC), ${localTime} (Kyiv)`,
  );
}

export async function createOrReplaceWeeklyPoll(): Promise<void> {
  logger.info("Creating or replacing weekly poll...");
  if (await pollService.isPollActive()) {
    await pollService.resetPoll();
  }
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

// On startup, call this to ensure missed polls are posted and scheduling is started
export async function initializeScheduler(): Promise<void> {
  const config = await pollService.getWeeklyConfig();
  if (!config.enabled) {
    return;
  }
  let shouldPost = false;
  if (!config.nextPollTime) {
    const nextTime = await calculateNextPollTime();
    config.nextPollTime = nextTime.toISOString();
    schedulerEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
    await pollService.setWeeklyConfig(config);
  } else {
    const now = new Date();
    const scheduled = new Date(config.nextPollTime);
    if (now >= scheduled) {
      shouldPost = true;
    }
  }
  if (shouldPost) {
    schedulerEvt.post({ type: "poll_triggered" });
    await createOrReplaceWeeklyPoll();
    const nextTime = await calculateNextPollTime();
    const config = await pollService.getWeeklyConfig();
    config.nextPollTime = nextTime.toISOString();
    schedulerEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
    await pollService.setWeeklyConfig(config);
  }
}

// Event listener for scheduler events
export function initializeSchedulerEventListeners() {
  schedulerEvt.attach((event) => {
    if (event.type === "poll_scheduled" && event.nextPollTime) {
      logNextPollTime(event.nextPollTime);
    } else if (event.type === "poll_triggered") {
      logger.info("Poll triggered via event");
    }
  });
}

// --- Deno.cron: schedule poll check every minute ---
Deno.cron("Check and trigger weekly poll", "*/10 * * * *", async () => {
  const config = await pollService.getWeeklyConfig();
  if (!config.enabled || !config.nextPollTime) return;
  const now = new Date();
  const scheduled = new Date(config.nextPollTime);
  // Only trigger if now matches scheduled time exactly (to the minute)
  if (
    now.getUTCFullYear() === scheduled.getUTCFullYear() &&
    now.getUTCMonth() === scheduled.getUTCMonth() &&
    now.getUTCDate() === scheduled.getUTCDate() &&
    now.getUTCHours() === scheduled.getUTCHours() &&
    now.getUTCMinutes() === scheduled.getUTCMinutes()
  ) {
    logger.info("[cron] Time to post the weekly poll!");
    schedulerEvt.post({ type: "poll_triggered" });
    await createOrReplaceWeeklyPoll();
    const nextTime = await calculateNextPollTime();
    config.nextPollTime = nextTime.toISOString();
    schedulerEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
    await pollService.setWeeklyConfig(config);
  }
});
