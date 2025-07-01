import { appEvt } from "./events.ts";
import {
  createStatusMessage,
  isCompleted,
  resetPoll,
  sendPollCompletionMessage,
  setPollState,
  stopPoll,
  updateStatusMessage,
} from "../services/poll-service.ts";
import { logNextPollTime, scheduleNextPoll } from "../services/scheduler.ts";
import { logger } from "../utils/logger.ts";
import { PollState } from "../constants/types.ts";

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
      await sendPollCompletionMessage();
      await stopPoll();
      await setPollState({ isActive: false } as PollState);
      break;
    }
    case "weekly_schedule_changed": {
      const config = event.config;
      if (config.enabled) {
        await scheduleNextPoll();
      } else {
        resetPoll();
      }
      break;
    }
  }
});
