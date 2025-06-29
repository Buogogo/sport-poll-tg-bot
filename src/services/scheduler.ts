import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);
import * as pollService from "./poll-service.ts";
import { schedulerEvt } from "../events/events.ts";
import { logger } from "../utils/logger.ts";

let intervalId: number | null = null;

export function clearSchedule(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function getNextPollTime(): Date | null {
  const { nextPollTime } = pollService.getWeeklyConfig();
  return nextPollTime ? new Date(nextPollTime) : null;
}

export function calculateNextPollTime(): Date {
  const { randomWindowMinutes, dayOfWeek, startHour } = pollService
    .getWeeklyConfig();
  const now = dayjs().tz("Europe/Kiev");
  const minute = Math.floor(Math.random() * randomWindowMinutes);
  let poll = now.day(dayOfWeek).hour(startHour).minute(minute)
    .second(0).millisecond(0);
  if (poll.isBefore(now)) poll = poll.add(1, "week");
  return poll.utc().toDate();
}

export function schedulePoll(): void {
  clearSchedule();
  const config = pollService.getWeeklyConfig();
  if (!config.enabled) {
    logger.info("Weekly poll is disabled, not scheduling.");
    return;
  }
  if (!config.nextPollTime) {
    // First time or after enabling, calculate and persist next time
    const nextTime = calculateNextPollTime();
    config.nextPollTime = nextTime.toISOString();
    schedulerEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
  }
  intervalId = setInterval(async () => {
    const { nextPollTime, enabled } = pollService.getWeeklyConfig();
    if (!enabled || !nextPollTime) return;
    const now = new Date();
    const scheduled = new Date(nextPollTime);
    if (now >= scheduled) {
      logger.info("Time to post the weekly poll!");
      schedulerEvt.post({ type: "poll_triggered" });
      await createOrReplaceWeeklyPoll();
      // Calculate and persist next time
      const nextTime = calculateNextPollTime();
      const config = pollService.getWeeklyConfig();
      config.nextPollTime = nextTime.toISOString();
      schedulerEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
    }
  }, 60 * 1000); // Check every minute
}

function logNextPollTime(time: Date) {
  const localTime = dayjs(time).tz("Europe/Kiev").format();
  logger.info(
    `Next poll scheduled for: ${time.toISOString()} (UTC), ${localTime} (Kyiv)`,
  );
}

export async function createOrReplaceWeeklyPoll(): Promise<void> {
  logger.info("Creating or replacing weekly poll...");
  if (pollService.isPollActive()) {
    pollService.resetPoll();
  }
  const { question, positiveOption, negativeOption, targetVotes } = pollService
    .createWeeklyPoll();
  await pollService.createPoll(
    question,
    positiveOption,
    negativeOption,
    targetVotes,
  );
  logger.info("Poll created.");
}

// On startup, call this to ensure missed polls are posted and scheduling is started
export async function initializeScheduler(): Promise<void> {
  const config = pollService.getWeeklyConfig();
  if (!config.enabled) {
    clearSchedule();
    return;
  }
  let shouldPost = false;
  if (!config.nextPollTime) {
    // No scheduled time, schedule for the future
    const nextTime = calculateNextPollTime();
    config.nextPollTime = nextTime.toISOString();
    schedulerEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
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
    const nextTime = calculateNextPollTime();
    config.nextPollTime = nextTime.toISOString();
    schedulerEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
  }
  schedulePoll();
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
