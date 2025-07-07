import { appEvt } from "./events.ts";
import {
  createStatusMessage,
  getPollState,
  isCompleted,
  sendPollCompletionMessage,
  setPollState,
  stopPoll,
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
      if (await isCompleted()) {
        appEvt.post({ type: "poll_completed", pollState: event.pollState });
      }
      break;
    }
    case "vote_revoked": {
      await updateStatusMessage();
      break;
    }
    case "poll_completed": {
      await stopPoll();
      await sendPollCompletionMessage();
      const pollState = await getPollState();
      pollState.isTargetReached = true;
      await setPollState(pollState);
      await scheduleNextPoll({ forNextWeek: true });
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
