import { appEvt } from "./events.ts";
import {
  createStatusMessage,
  resetPoll,
  updateStatusMessage,
} from "../services/poll-service.ts";
import { logNextPollTime, scheduleNextPoll } from "../services/scheduler.ts";
import { logger } from "../utils/logger.ts";

appEvt.attach(async (event) => {
  switch (event.type) {
    case "poll_scheduled":
      if (event.nextPollTime) {
        logNextPollTime(event.nextPollTime);
      }
      break;
    case "poll_triggered":
      logger.info("Poll triggered via event");
      break;
    case "poll_started": {
      await createStatusMessage();
      await scheduleNextPoll();
      break;
    }
    case "vote_added":
    case "vote_revoked": {
      await updateStatusMessage();
      break;
    }
    case "config_changed": {
      const config = event.config;
      if (
        "enabled" in config &&
        (config as import("../constants/types.ts").WeeklyConfig).enabled
      ) {
        await scheduleNextPoll();
      }
      break;
    }
    case "poll_enabled": {
      const config = event.config;
      if (config.enabled) {
        await scheduleNextPoll();
      }
      break;
    }
    case "poll_disabled": {
      const config = event.config;
      if (!config.enabled) {
        resetPoll();
      }
      break;
    }
  }
});
