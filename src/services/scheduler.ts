import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);
import * as pollService from "./poll-service.ts";
import { appEvt } from "../events/events.ts";
import { logger } from "../utils/logger.ts";

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

function logNextPollTime(time: Date) {
  const localTime = dayjs(time).tz("Europe/Kiev").format();
  logger.info(
    `Next poll scheduled for: ${time.toISOString()} (UTC), ${localTime} (Kyiv)`,
  );
}

export async function createOrReplaceWeeklyPoll(): Promise<void> {
  logger.info("Creating or replacing weekly poll...");
  if (await pollService.isPollActive()) {
    pollService.resetPoll();
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

export async function initializeScheduler(): Promise<void> {
  const config = await pollService.getWeeklyConfig();
  if (!config.enabled) {
    return;
  }
  let shouldPost = false;
  if (!config.nextPollTime) {
    const nextTime = await calculateNextPollTime();
    config.nextPollTime = nextTime.toISOString();
    appEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
    await pollService.setWeeklyConfig(config);
  } else {
    const now = new Date();
    const scheduled = new Date(config.nextPollTime);
    if (now >= scheduled) {
      shouldPost = true;
    }
  }
  if (shouldPost) {
    appEvt.post({ type: "poll_triggered" });
    await createOrReplaceWeeklyPoll();
    const nextTime = await calculateNextPollTime();
    const config = await pollService.getWeeklyConfig();
    config.nextPollTime = nextTime.toISOString();
    appEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
    await pollService.setWeeklyConfig(config);
  }
}

appEvt.attach(async (event) => {
  if (event.type === "poll_scheduled" && event.nextPollTime) {
    logNextPollTime(event.nextPollTime);
  } else if (event.type === "poll_triggered") {
    logger.info("Poll triggered via event");
  } else if (event.type === "poll_posted") {
    const nextPollTime = await calculateNextPollTime();
    await pollService.setWeeklyConfig({
      nextPollTime: nextPollTime.toISOString(),
    });
    appEvt.post({ type: "poll_scheduled", nextPollTime });
  } else if (event.type === "config_changed") {
    const config = event.config;
    if (
      "enabled" in config &&
      (config as import("../constants/types.ts").WeeklyConfig).enabled
    ) {
      const nextPollTime = await calculateNextPollTime();
      await pollService.setWeeklyConfig({
        nextPollTime: nextPollTime.toISOString(),
      });
      appEvt.post({ type: "poll_scheduled", nextPollTime });
    }
  } else if (event.type === "poll_enabled") {
    const config = event.config;
    if (config.enabled) {
      const nextPollTime = await calculateNextPollTime();
      await pollService.setWeeklyConfig({
        nextPollTime: nextPollTime.toISOString(),
      });
      appEvt.post({ type: "poll_scheduled", nextPollTime });
    }
  } else if (event.type === "poll_disabled") {
    const config = event.config;
    if (!config.enabled) {
      pollService.resetPoll();
    }
  }
});

Deno.cron("Check and trigger weekly poll", "*/10 * * * *", async () => {
  const config = await pollService.getWeeklyConfig();
  if (!config.enabled || !config.nextPollTime) return;
  const now = new Date();
  const scheduled = new Date(config.nextPollTime);
  if (now >= scheduled) {
    logger.info("[cron] Time to post the weekly poll!");
    appEvt.post({ type: "poll_triggered" });
    await createOrReplaceWeeklyPoll();
    const nextTime = await calculateNextPollTime(true, scheduled);
    appEvt.post({ type: "poll_scheduled", nextPollTime: nextTime });
    const config = await pollService.getWeeklyConfig();
    config.nextPollTime = nextTime.toISOString();
    await pollService.setWeeklyConfig(config);
  }
});
