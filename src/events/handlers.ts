import { appEvt } from "./events.ts";
import {
  createStatusMessage,
  deactivatePoll,
  getPollState,
  isCompleted,
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
      break;
    }
    case "vote_added": {
      await updateStatusMessage();
      const pollState = await getPollState();
      if (!pollState.targetReached && await isCompleted()) {
        appEvt.post({ type: "poll_completed", pollState: event.pollState });
      }
      break;
    }
    case "vote_revoked": {
      await updateStatusMessage();
      break;
    }
    case "poll_completed": {
      await deactivatePoll();
      await scheduleNextPoll({ forNextWeek: true });
      break;
    }
    case "poll_closed_manually": {
      await deactivatePoll();
      break;
    }
    case "poll_replaced": {
      await deactivatePoll();
      break;
    }
    case "weekly_schedule_config_changed": {
      const config = event.config;
      if (config.enabled) {
        await scheduleNextPoll();
      }
      break;
    }
  }
});
