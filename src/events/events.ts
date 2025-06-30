import { Evt } from "evt";
import { Vote } from "../models/vote.ts";
import {
  InstantPollConfig,
  PollState,
  WeeklyConfig,
} from "../constants/types.ts";

export interface PollVoteEvent {
  type: "vote_added" | "vote_revoked";
  vote: Vote;
  userId?: number;
  userName?: string;
}

export interface PollStateEvent {
  type: "poll_started" | "poll_completed" | "poll_closed" | "poll_reset";
  pollState: PollState;
}

export interface ConfigUpdateEvent {
  type: "weekly_config_updated" | "instant_poll_config_updated";
  config: WeeklyConfig | InstantPollConfig;
}

export interface StatusMessageEvent {
  type: "status_message_created" | "status_message_updated";
  messageId: number;
  chatId: number;
}

export interface SchedulerEvent {
  type: "poll_scheduled" | "poll_triggered";
  nextPollTime?: Date;
}

export interface SessionEvent {
  type: "session_reset";
  ctx: unknown; // TODO: Use MyContext if circular import is resolved
}

export const pollVoteEvt = Evt.create<PollVoteEvent>();
export const pollStateEvt = Evt.create<PollStateEvent>();
export const configUpdateEvt = Evt.create<ConfigUpdateEvent>();
export const statusMessageEvt = Evt.create<StatusMessageEvent>();
export const schedulerEvt = Evt.create<SchedulerEvent>();
export const sessionEvt = Evt.create<SessionEvent>();
