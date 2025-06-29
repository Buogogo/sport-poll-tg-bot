import { Bot } from "grammy";
import { MyContext } from "../middleware/session.ts";
import {
  InstantPollConfig,
  PollState,
  UserFacingError,
  VoteInfo,
  WeeklyConfig,
} from "../constants/types.ts";
import {
  DEFAULT_INSTANT_POLL_CONFIG,
  DEFAULT_POLL_STATE,
  DEFAULT_WEEKLY_CONFIG,
} from "../constants/config.ts";
import { MESSAGES } from "../constants/messages.ts";
import { Vote } from "../models/vote.ts";
import { parseRevokeCommand, parseVoteCommand } from "../utils/utils.ts";
import * as persistence from "./persistence.ts";
import * as scheduler from "./scheduler.ts";
import {
  configUpdateEvt,
  pollStateEvt,
  pollVoteEvt,
} from "../events/events.ts";

// State
let pollState: PollState = { ...DEFAULT_POLL_STATE, votes: [] };
let weeklyConfig: WeeklyConfig = DEFAULT_WEEKLY_CONFIG;
let instantPollConfig: InstantPollConfig = DEFAULT_INSTANT_POLL_CONFIG;

// Bot and config references (will be set by bot service)
let botInstance: Bot<MyContext> | null = null;
let configInstance: {
  botToken: string;
  adminUserIds: number[];
  targetGroupChatId: number;
} | null = null;

export function setBotInstance(
  bot: Bot<MyContext>,
  config: {
    botToken: string;
    adminUserIds: number[];
    targetGroupChatId: number;
  },
) {
  botInstance = bot;
  configInstance = config;
}

export async function loadPersistedData(): Promise<void> {
  const { pollState: ps, weeklyConfig: wc, instantPollConfig: ic } =
    await persistence.loadAll();
  pollState = ps;
  weeklyConfig = wc;
  instantPollConfig = ic;
}

export function getPollState(): PollState {
  return pollState;
}

export function getWeeklyConfig(): WeeklyConfig {
  return weeklyConfig;
}

export function getInstantPollConfig(): InstantPollConfig {
  return instantPollConfig;
}

export function setPollState(updates: Partial<PollState>): void {
  Object.assign(pollState, updates);
}

export function setWeeklyConfig(
  updates: Partial<WeeklyConfig>,
): void {
  Object.assign(weeklyConfig, updates);

  // If enabling, or if any schedule-related field is updated, recalculate nextPollTime
  if (
    (typeof updates.enabled !== "undefined" && updates.enabled) ||
    typeof updates.startHour !== "undefined" ||
    typeof updates.randomWindowMinutes !== "undefined" ||
    typeof updates.dayOfWeek !== "undefined"
  ) {
    weeklyConfig.nextPollTime = scheduler.calculateNextPollTime().toISOString();
  }

  configUpdateEvt.post({ type: "weekly_config_updated", config: weeklyConfig });

  if (weeklyConfig.enabled) {
    // scheduler.schedulePoll(); // Removed, handled by cron
  } else {
    // Removed scheduler.clearSchedule();, handled by cron
  }
}

export function setInstantPollConfig(
  updates: Partial<InstantPollConfig>,
): void {
  Object.assign(instantPollConfig, updates);
  configUpdateEvt.post({
    type: "instant_poll_config_updated",
    config: instantPollConfig,
  });
}

export function getPositiveVotes(): number {
  return pollState.votes.filter((v) => v.optionId === 0).length;
}

export function buildStatusMessage(): string {
  if (!pollState.isActive && pollState.targetVotes === 0) return "";
  const currentVotes = getPositiveVotes();
  const completed = isCompleted();
  const remaining = pollState.targetVotes - currentVotes;
  let status = MESSAGES.STATUS_HEADER;
  status += completed ? MESSAGES.STATUS_COMPLETED : MESSAGES.STATUS_ACTIVE;
  status += MESSAGES.STATUS_TARGET(pollState.targetVotes);
  status += MESSAGES.STATUS_CURRENT(currentVotes);
  if (!completed) {
    status += MESSAGES.STATUS_REMAINING(remaining);
    status += MESSAGES.STATUS_INSTRUCTIONS;
  } else {
    status += MESSAGES.STATUS_THANKS;
  }
  const votes = pollState.votes.filter((v) => v.optionId === 0);
  status += MESSAGES.STATUS_VOTES_LIST +
    votes.map((v, i) =>
      MESSAGES.STATUS_VOTE_ITEM(i + 1, v.userName ?? "Анонім", v.requesterName)
    ).join("\n") + (votes.length ? "\n" : "");
  return status;
}

export function isCompleted(): boolean {
  return getPositiveVotes() >= pollState.targetVotes;
}

export async function initializePoll(
  question: string,
  positiveOption: string,
  negativeOption: string,
  targetVotes: number,
  telegramMessageId?: number,
  isInstantPoll?: boolean,
): Promise<void> {
  if (pollState.isActive) resetPoll();
  let finalTelegramMessageId = telegramMessageId;
  if (isInstantPoll && !telegramMessageId && botInstance && configInstance) {
    const poll = await botInstance.api.sendPoll(
      configInstance.targetGroupChatId,
      question,
      [{ text: positiveOption }, { text: negativeOption }],
      { is_anonymous: false, type: "regular" },
    );
    finalTelegramMessageId = poll.message_id;
  }
  pollState = {
    isActive: true,
    question,
    positiveOption,
    negativeOption,
    targetVotes,
    telegramMessageId: finalTelegramMessageId,
    votes: [],
    statusMessageId: undefined,
  };
  pollStateEvt.post({ type: "poll_started", pollState });
}

export async function createPoll(
  question: string,
  positiveOption: string,
  negativeOption: string,
  targetVotes: number,
): Promise<void> {
  if (pollState.isActive) resetPoll();
  if (!botInstance || !configInstance) throw new Error("Bot not initialized");

  const poll = await botInstance.api.sendPoll(
    configInstance.targetGroupChatId,
    question,
    [{ text: positiveOption }, { text: negativeOption }],
    { is_anonymous: false, type: "regular" },
  );
  pollState = {
    isActive: true,
    question,
    positiveOption,
    negativeOption,
    targetVotes,
    telegramMessageId: poll.message_id,
    votes: [],
    statusMessageId: undefined,
  };
  pollStateEvt.post({ type: "poll_started", pollState });
}

export function resetPoll(): void {
  pollState = {
    ...DEFAULT_POLL_STATE,
    votes: [],
  };
  pollStateEvt.post({ type: "poll_reset", pollState });
}

export function* iteratePositiveVotes(): Generator<VoteInfo> {
  let currentNumber = 1;
  for (let i = 0; i < pollState.votes.length; i++) {
    const v = pollState.votes[i];
    if (v.optionId === 0) {
      if (v.userId) {
        yield {
          type: "direct",
          number: currentNumber++,
          userId: v.userId,
          userName: v.userName ?? "Анонім",
          vote: v,
        };
      } else {
        yield {
          type: "external",
          number: currentNumber++,
          index: i,
          userName: v.userName ?? "Анонім",
          vote: v,
        };
      }
    }
  }
}

export function findVoteByNumber(targetNumber: number): VoteInfo | null {
  for (const voteInfo of iteratePositiveVotes()) {
    if (voteInfo.number === targetNumber) return voteInfo;
  }
  return null;
}

export function findLastVoteByRequesterId(requesterId: number) {
  const votes = pollState.votes;
  const i = [...votes].reverse().findIndex((v) =>
    v.requesterId === requesterId
  );
  return i === -1 ? null : {
    index: votes.length - 1 - i,
    vote: votes[votes.length - 1 - i],
  };
}

export function addVote(ctx: MyContext): void {
  if (!pollState.isActive) {
    throw new UserFacingError(ctx, MESSAGES.POLL_CLOSED);
  }
  const { user, option_ids } = ctx.update.poll_answer!;
  const optionId = option_ids[0];
  if (optionId === 0) {
    const already = pollState.votes.some(
      (v) => v.userId === user!.id && v.optionId === 0,
    );
    if (already) return;
    const currentVotes = getPositiveVotes();
    const remaining = pollState.targetVotes - currentVotes;
    if (remaining <= 0) return;
  }
  const vote = new Vote(
    optionId,
    user!.id,
    user!.first_name || "Анонім",
    undefined,
    undefined,
  );
  pollState.votes.push(vote);
  pollVoteEvt.post({
    type: "vote_added",
    vote,
    userId: user!.id,
    userName: user!.first_name,
  });

  if (isCompleted() && pollState.isActive) {
    pollState.isActive = false;
    pollStateEvt.post({ type: "poll_completed", pollState });
  }
}

export function addVotesBulk(
  ctx: MyContext,
  names?: string[],
  count?: number,
): string | void {
  if (!pollState.isActive) {
    throw new UserFacingError(ctx, MESSAGES.POLL_CLOSED);
  }
  const currentVotes = getPositiveVotes();
  const remaining = pollState.targetVotes - currentVotes;
  let votes: Array<Vote> = [];
  if (names && names.length) {
    votes = names.map((name) =>
      new Vote(
        0,
        undefined,
        name || "Анонім",
        ctx.from?.id,
        ctx.from?.first_name,
      )
    );
  } else if (count) {
    votes = Array(count).fill(0).map(() =>
      new Vote(
        0,
        undefined,
        "Анонім",
        ctx.from?.id,
        ctx.from?.first_name,
      )
    );
  } else {
    votes = [
      new Vote(
        0,
        undefined,
        "Анонім",
        ctx.from?.id,
        ctx.from?.first_name,
      ),
    ];
  }
  if (votes.length > remaining) {
    return MESSAGES.TOO_MANY_VOTES(votes.length, remaining);
  }
  for (const v of votes) {
    pollState.votes.push(v);
    pollVoteEvt.post({
      type: "vote_added",
      vote: v,
      userId: v.requesterId,
      userName: v.requesterName,
    });
  }

  if (isCompleted() && pollState.isActive) {
    pollState.isActive = false;
    pollStateEvt.post({ type: "poll_completed", pollState });
  }
}

export function revokeVoteByNumber(
  voteNumber: number,
  userId: number,
  isAdmin: boolean,
  ctx: MyContext,
): string {
  if (!pollState.isActive) {
    throw new UserFacingError(ctx, MESSAGES.POLL_CLOSED);
  }
  if (voteNumber < 1) {
    throw new UserFacingError(ctx, MESSAGES.POLL_VOTE_NUMBER_TOO_LOW);
  }
  const votes = pollState.votes.filter((v) => v.optionId === 0);
  const vote = votes[voteNumber - 1];
  if (!vote) {
    throw new UserFacingError(ctx, MESSAGES.VOTE_NOT_FOUND(voteNumber));
  }
  if (vote.userId) {
    throw new UserFacingError(
      ctx,
      MESSAGES.DIRECT_VOTE_REVOKE_ERROR,
    );
  }
  if (vote.requesterId !== userId && !isAdmin) {
    throw new UserFacingError(
      ctx,
      MESSAGES.PERMISSION_REVOKE_ERROR,
    );
  }
  const idx = pollState.votes.indexOf(vote);
  if (idx !== -1) {
    pollState.votes.splice(idx, 1);
    pollVoteEvt.post({
      type: "vote_revoked",
      vote,
      userId: vote.requesterId,
      userName: vote.requesterName,
    });
  }

  return MESSAGES.VOTE_REVOKED_SUCCESS(voteNumber, vote.userName ?? "Анонім");
}

export function revokeDirectVoteByUserId(
  userId: number,
  ctx: MyContext,
): void {
  if (!pollState.isActive) {
    throw new UserFacingError(ctx, MESSAGES.POLL_CLOSED);
  }
  const idx = pollState.votes.findLastIndex((v) => v.userId === userId);
  if (idx === -1) return;
  const vote = pollState.votes[idx];
  pollState.votes.splice(idx, 1);
  pollVoteEvt.post({
    type: "vote_revoked",
    vote,
    userId: vote.userId,
    userName: vote.userName,
  });
}

export function createWeeklyPoll(): {
  question: string;
  positiveOption: string;
  negativeOption: string;
  targetVotes: number;
} {
  return {
    question: weeklyConfig.question,
    positiveOption: weeklyConfig.positiveOption,
    negativeOption: weeklyConfig.negativeOption,
    targetVotes: weeklyConfig.targetVotes,
  };
}

export function isPollActive(): boolean {
  return pollState.isActive;
}

export async function handleVoteCommand(ctx: MyContext): Promise<void> {
  const { names, count } = parseVoteCommand(ctx.message!.text!);
  const result = await addVotesBulk(ctx, names, count);
  if (result) await ctx.reply(result);
}

export async function handleRevokeCommand(ctx: MyContext): Promise<void> {
  const voteNumber = parseRevokeCommand(ctx.message!.text!);
  if (!configInstance) throw new Error("Config not initialized");
  const userId = ctx.from?.id!;
  const isAdmin = configInstance.adminUserIds.includes(userId);
  const result = await revokeVoteByNumber(
    voteNumber,
    userId,
    isAdmin,
    ctx,
  );
  await ctx.reply(result);
}

export async function handleVote(ctx: MyContext): Promise<void> {
  const { option_ids, user } = ctx.update.poll_answer!;
  if (option_ids.length === 0) revokeDirectVoteByUserId(user!.id, ctx);
  switch (option_ids[0]) {
    case 0:
      await addVote(ctx);
      break;
  }
}

export function closePollLogic(): { closed: boolean; message: string } {
  if (isPollActive()) {
    resetPoll();
    return { closed: true, message: MESSAGES.POLL_CLOSED_CB };
  } else {
    return { closed: false, message: MESSAGES.NO_ACTIVE_POLLS_CB };
  }
}

export async function confirmPollLogic(): Promise<
  { success: boolean; message: string }
> {
  const config = getInstantPollConfig();
  await createPoll(
    config.question,
    config.positiveOption,
    config.negativeOption,
    config.targetVotes,
  );
  return { success: true, message: MESSAGES.POLL_SUCCESS };
}
