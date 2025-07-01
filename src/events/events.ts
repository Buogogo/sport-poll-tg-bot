import { Evt } from "evt";
import { PollState, WeeklyConfig } from "../constants/types.ts";

export interface WeeklyScheduleChangedEvent {
  type: "weekly_schedule_changed";
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

export type AppEvent =
  | WeeklyScheduleChangedEvent
  | PollScheduledEvent
  | PollTriggeredEvent
  | VoteAddedEvent
  | VoteRevokedEvent
  | PollStartedEvent
  | PollCompletedEvent;

export const appEvt = Evt.create<AppEvent>();
