import { Evt } from "evt";
import {
  InstantPollConfig,
  PollState,
  WeeklyConfig,
} from "../constants/types.ts";

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
  | ConfigChangedEvent
  | PollEnabledEvent
  | PollDisabledEvent
  | PollScheduledEvent
  | PollTriggeredEvent
  | VoteAddedEvent
  | VoteRevokedEvent
  | PollStartedEvent;

export const appEvt = Evt.create<AppEvent>();
