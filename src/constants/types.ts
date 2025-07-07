import { Context } from "grammy";
import { Vote } from "../models/vote.ts";

export interface Config {
  botToken: string;
  adminUserIds: number[];
  targetGroupChatId: number;
}

// Vote-related utility types
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
  dayOfWeek: number; // 1 = Monday, 7 = Sunday
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

export interface AdminSession {
  chatId: number;
  lastMenuMessageId?: number;
  confirmationMessages?: number[];
  // Legacy properties for compatibility with old admin.ts
  editTarget?: string;
  editContext?: "poll" | "weekly";
  pendingValue?: string;
  messagesToClear?: number[];
  pollData?: {
    question: string;
    positiveOption: string;
    negativeOption: string;
    targetVotes: number;
  };
}

// Poll event types
export type PollEvent =
  | "vote_added"
  | "vote_revoked"
  | "poll_completed"
  | "poll_started";

// Custom error types for specific error handling
export class UserFacingError extends Error {
  ctx: Context;
  constructor(ctx: Context, message: string) {
    super(message);
    this.name = "UserFacingError";
    this.ctx = ctx;
  }
}
