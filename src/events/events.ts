import { Evt } from "evt";
import {
  InstantPollConfig,
  PollState,
  WeeklyConfig,
} from "../constants/types.ts";
import {
  createStatusMessage,
  updateStatusMessage,
} from "../services/poll-service.ts";

// New event types for unified scheduling
export interface PollPostedEvent {
  type: "poll_posted";
  pollState: PollState;
}

export interface ConfigChangedEvent {
  type: "config_changed";
  config: WeeklyConfig | InstantPollConfig;
}

export interface PollEnabledEvent {
  type: "poll_enabled";
  config: WeeklyConfig;
}

export interface PollDisabledEvent {
  type: "poll_disabled";
  config: WeeklyConfig;
}

export interface PollScheduledEvent {
  type: "poll_scheduled";
  nextPollTime: Date;
}

export interface PollTriggeredEvent {
  type: "poll_triggered";
}

export type AppEvent =
  | PollPostedEvent
  | ConfigChangedEvent
  | PollEnabledEvent
  | PollDisabledEvent
  | PollScheduledEvent
  | PollTriggeredEvent;

export const appEvt = Evt.create<AppEvent>();

appEvt.attach(async (event) => {
  if (event.type === "poll_posted") {
    await createStatusMessage();
    await updateStatusMessage();
  } else if (event.type === "config_changed") {
    await updateStatusMessage();
  }
});
