import { Bot } from "grammy";
import { MyContext } from "../middleware/session.ts";
import {
  InstantPollConfig,
  PollState,
  UserFacingError,
  VoteInfo,
  WeeklyConfig,
} from "../constants/types.ts";
import { DEFAULT_POLL_STATE } from "../constants/config.ts";
import { MESSAGES } from "../constants/messages.ts";
import { Vote } from "../models/vote.ts";
import { parseRevokeCommand, parseVoteCommand } from "../utils/utils.ts";
import * as persistence from "./persistence.ts";
import * as scheduler from "./scheduler.ts";
import { pollStateEvt, pollVoteEvt } from "../events/events.ts";

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

// --- Poll State ---
export async function getPollState(): Promise<PollState> {
  return await persistence.getPollState();
}

export async function setPollState(state: PollState): Promise<void> {
  await persistence.setPollState(state);
}

// --- Weekly Config ---
export async function getWeeklyConfig(): Promise<WeeklyConfig> {
  return await persistence.getWeeklyConfig();
}

export async function setWeeklyConfig(
  updates: Partial<WeeklyConfig>,
): Promise<void> {
  const config = await persistence.getWeeklyConfig();
  Object.assign(config, updates);
  if (
    (typeof updates.enabled !== "undefined" && updates.enabled) ||
    typeof updates.startHour !== "undefined" ||
    typeof updates.randomWindowMinutes !== "undefined" ||
    typeof updates.dayOfWeek !== "undefined"
  ) {
    const nextPollTime = await scheduler.calculateNextPollTime();
    config.nextPollTime = (await nextPollTime).toISOString();
  }
  await persistence.setWeeklyConfig(config);
}

// --- Instant Poll Config ---
export async function getInstantPollConfig(): Promise<InstantPollConfig> {
  return await persistence.getInstantPollConfig();
}

export async function setInstantPollConfig(
  updates: Partial<InstantPollConfig>,
): Promise<void> {
  const config = await persistence.getInstantPollConfig();
  Object.assign(config, updates);
  await persistence.setInstantPollConfig(config);
}

export async function getPositiveVotes(): Promise<number> {
  const pollState = await getPollState();
  return pollState.votes.filter((v) => v.optionId === 0).length;
}

export async function buildStatusMessage(): Promise<string> {
  const pollState = await getPollState();
  if (!pollState.isActive && pollState.targetVotes === 0) return "";
  const currentVotes = pollState.votes.filter((v) => v.optionId === 0).length;
  const completed = await isCompleted();
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

export async function isCompleted(): Promise<boolean> {
  const pollState = await getPollState();
  const currentVotes = pollState.votes.filter((v) => v.optionId === 0).length;
  return currentVotes >= pollState.targetVotes;
}

export async function startPoll(
  question: string,
  positiveOption: string,
  negativeOption: string,
  targetVotes: number,
): Promise<void> {
  const pollState = await getPollState();
  if (pollState.isActive) await resetPoll();
  if (!botInstance || !configInstance) throw new Error("Bot not initialized");

  const poll = await botInstance.api.sendPoll(
    configInstance.targetGroupChatId,
    question,
    [{ text: positiveOption }, { text: negativeOption }],
    { is_anonymous: false, type: "regular" },
  );
  const newState: PollState = {
    isActive: true,
    question,
    positiveOption,
    negativeOption,
    targetVotes,
    telegramMessageId: poll.message_id,
    votes: [],
    statusMessageId: undefined,
  };
  await setPollState(newState);
  pollStateEvt.post({ type: "poll_started", pollState: newState });
}

export function* iteratePositiveVotesSync(
  pollState: PollState,
): Generator<VoteInfo> {
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

export async function findVoteByNumber(
  targetNumber: number,
): Promise<VoteInfo | null> {
  const pollState = await getPollState();
  for (const voteInfo of iteratePositiveVotesSync(pollState)) {
    if (voteInfo.number === targetNumber) return voteInfo;
  }
  return null;
}

export async function findLastVoteByRequesterId(
  requesterId: number,
): Promise<{ index: number; vote: Vote } | null> {
  const pollState = await getPollState();
  const votes = pollState.votes;
  const i = [...votes].reverse().findIndex((v) =>
    v.requesterId === requesterId
  );
  return i === -1 ? null : {
    index: votes.length - 1 - i,
    vote: votes[votes.length - 1 - i],
  };
}

export async function addVote(ctx: MyContext): Promise<void> {
  const pollState = await getPollState();
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
    const currentVotes = pollState.votes.filter((v) => v.optionId === 0).length;
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
  await setPollState(pollState);
  pollVoteEvt.post({
    type: "vote_added",
    vote,
    userId: user!.id,
    userName: user!.first_name,
  });
}

export async function addVotesBulk(
  ctx: MyContext,
  names?: string[],
  count?: number,
): Promise<string | void> {
  const pollState = await getPollState();
  if (!pollState.isActive) {
    throw new UserFacingError(ctx, MESSAGES.POLL_CLOSED);
  }
  const currentVotes = pollState.votes.filter((v) => v.optionId === 0).length;
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
  await setPollState(pollState);
}

export async function revokeVoteByNumber(
  voteNumber: number,
  userId: number,
  isAdmin: boolean,
  ctx: MyContext,
): Promise<string> {
  const pollState = await getPollState();
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
  await setPollState(pollState);
  return MESSAGES.VOTE_REVOKED_SUCCESS(voteNumber, vote.userName ?? "Анонім");
}

export async function revokeDirectVoteByUserId(
  userId: number,
  ctx: MyContext,
): Promise<void> {
  const pollState = await getPollState();
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
  await setPollState(pollState);
}

export async function createWeeklyPoll(): Promise<{
  question: string;
  positiveOption: string;
  negativeOption: string;
  targetVotes: number;
}> {
  const weeklyConfig = await getWeeklyConfig();
  return {
    question: weeklyConfig.question,
    positiveOption: weeklyConfig.positiveOption,
    negativeOption: weeklyConfig.negativeOption,
    targetVotes: weeklyConfig.targetVotes,
  };
}

export async function isPollActive(): Promise<boolean> {
  const pollState = await getPollState();
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
  if (option_ids.length === 0) await revokeDirectVoteByUserId(user!.id, ctx);
  switch (option_ids[0]) {
    case 0:
      await addVote(ctx);
      break;
  }
}

export async function closePollLogic(): Promise<
  { closed: boolean; message: string }
> {
  if (await isPollActive()) {
    await resetPoll();
    return { closed: true, message: MESSAGES.POLL_CLOSED_CB };
  } else {
    return { closed: false, message: MESSAGES.NO_ACTIVE_POLLS_CB };
  }
}

export async function confirmPollLogic(): Promise<
  { success: boolean; message: string }
> {
  const config = await getInstantPollConfig();
  await startPoll(
    config.question,
    config.positiveOption,
    config.negativeOption,
    config.targetVotes,
  );
  return { success: true, message: MESSAGES.POLL_SUCCESS };
}

export async function resetPoll(): Promise<void> {
  const newState: PollState = {
    ...DEFAULT_POLL_STATE,
    votes: [],
  };
  await setPollState(newState);
}
