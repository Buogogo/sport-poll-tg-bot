import { Context } from "grammy";
import { Vote } from "../models/vote.ts";

export interface Config {
  botToken: string;
  adminUserIds: number[];
  targetGroupChatId: number;
}

export type VoteInfo = {
  type: "direct";
  number: number;
  userId: number;
  userName: string;
  vote: Vote;
} | {
  type: "external";
  number: number;
  index: number;
  userName: string;
  vote: Vote;
};

export interface PollState {
  isTargetReached: boolean;
  question: string;
  positiveOption: string;
  negativeOption: string;
  targetVotes: number;
  telegramMessageId: number;
  statusMessageId?: number;
  votes: Vote[];
}

export interface WeeklyConfig {
  enabled: boolean;
  question: string;
  positiveOption: string;
  negativeOption: string;
  targetVotes: number;
  dayOfWeek: number;
  startHour: number;
  randomWindowMinutes: number;
  nextPollTime?: string | null;
}

export interface InstantPollConfig {
  question: string;
  positiveOption: string;
  negativeOption: string;
  targetVotes: number;
}

export type PollEvent =
  | "vote_added"
  | "vote_revoked"
  | "poll_completed"
  | "poll_started";

export class UserFacingError extends Error {
  ctx: Context;
  constructor(ctx: Context, message: string) {
    super(message);
    this.name = "UserFacingError";
    this.ctx = ctx;
  }
}
