import { Evt } from "evt";
import { PollState, WeeklyConfig } from "../constants/types.ts";

export interface WeeklyScheduleConfigChangedEvent {
  type: "weekly_schedule_config_changed";
  config: WeeklyConfig;
}

export interface PollCompletedEvent {
  type: "poll_completed";
  pollState: PollState;
}

export interface PollScheduledEvent {
  type: "poll_scheduled";
  nextPollTime: Date;
}

export interface PollTriggeredEvent {
  type: "poll_triggered";
}

export interface VoteAddedEvent {
  type: "vote_added";
  pollState: PollState;
  userId?: number;
  userName?: string;
  voteType: "direct" | "external";
}

export interface VoteRevokedEvent {
  type: "vote_revoked";
  pollState: PollState;
  userId?: number;
  userName?: string;
  voteType: "direct" | "external";
}

export interface PollStartedEvent {
  type: "poll_started";
  pollState: PollState;
}

export interface PollClosedManuallyEvent {
  type: "poll_closed_manually";
  pollState: PollState;
}

export interface PollReplacedEvent {
  type: "poll_replaced";
  pollState: PollState;
}

export type AppEvent =
  | WeeklyScheduleConfigChangedEvent
  | PollScheduledEvent
  | PollTriggeredEvent
  | VoteAddedEvent
  | VoteRevokedEvent
  | PollStartedEvent
  | PollCompletedEvent
  | PollClosedManuallyEvent
  | PollReplacedEvent;

export const appEvt = Evt.create<AppEvent>();
