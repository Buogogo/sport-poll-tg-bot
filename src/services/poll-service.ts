import { Bot } from "grammy";
import { MyContext } from "../middleware/session.ts";
import {
  InstantPollConfig,
  PollState,
  UserFacingError,
  VoteInfo,
  WeeklyConfig,
} from "../constants/types.ts";
import { MESSAGES } from "../constants/messages.ts";
import { Vote } from "../models/vote.ts";
import {
  parseRevokeCommand,
  parseVoteCommand,
} from "../commands/group-commands.ts";
import * as persistence from "./persistence.ts";
import { appEvt } from "../events/events.ts";
import { isAdmin } from "../utils/admin-utils.ts";

// Bot and config references (will be set by bot service)
let botInstance: Bot<MyContext> | null = null;
let configInstance: {
  botToken: string;
  adminUserIds: number[];
  targetGroupChatId: number;
} | null = null;

async function getPlayerNames(userIds: number[]): Promise<Map<number, string>> {
  const kv = await Deno.openKv();
  const keys = userIds.map((id) => ["player", id]);
  console.log("Debug: Fetching player names for user IDs:", userIds);
  console.log("Debug: KV keys to fetch:", keys);
  const results = await kv.getMany<string[]>(keys);
  console.log("Debug: KV fetch results:", results.map((r, i) => ({ 
    key: keys[i], 
    value: r.value, 
    versionstamp: r.versionstamp 
  })));
  const nameMap = new Map<number, string>();
  for (let i = 0; i < userIds.length; i++) {
    if (results[i].value) {
      nameMap.set(userIds[i], results[i].value!);
      console.log(`Debug: Mapped user ${userIds[i]} to name "${results[i].value}"`);
    } else {
      console.log(`Debug: No player name found for user ${userIds[i]}`);
    }
  }
  await kv.close();
  ,

  console.log("Debug: Final name map:", Object.fromEntries(nameMap));
  return nameMap;
}

export functio
    n setBotInstance(
   ,
  
  bot: Bot<MyContext>,
  config: {
    botToken: string;
    adminUserIds: number[];
    targetGroupCha
        tId: number;,
      
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
  await persistence.setWeeklyConfig(config);
  const shouldReschedule = typeof updates.enabled !== "undefined" ||
    (
      config.enabled &&
      (typeof updates.startHour !== "undefined" ||
        typeof updates.randomWindowMinutes !== "undefined" ||
        typeof updates.dayOfWeek !== "undefined")
    );
  if (shouldReschedule || Object.keys(updates).length > 0) {
    appEvt.post({ type: "weekly_schedule_config_changed", config });
  }
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
  if (pollState.isTargetReached && pollState.targetVotes === 0) return "";
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
  const userIds = votes.filter((v) => v.userId).map((v) => v.userId!);
  const playerNames = await getPlayerNames(userIds);
  const voteItems = votes.map((v, i) => {
    let displayName = v.userName ?? MESSAGES.ANONYMOUS_NAME;
    if (v.userId && playerNames.has(v.userId)) {
      displayName = playerNames.get(v.userId)!;
    }
    return MESSAGES.STATUS_VOTE_ITEM(
      i + 1,
      escapeHtml(displayName),
      v.requesterName ? escapeHtml(v.requesterName) : undefined,
    );
  });
  status += MESSAGES.STATUS_VOTES_LIST + voteItems.join("\n") +
    (votes.length ? "\n" : "");
  return status;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  if (!pollState.isTargetReached) await resetPoll();
  if (!botInstance || !configInstance) throw new Error("Bot not initialized");

  const poll = await botInstance.api.sendPoll(
    configInstance.targetGroupChatId,
    question,
    [{ text: positiveOption }, { text: negativeOption }],
    { is_anonymous: false, type: "regular" },
  );
  const newState: PollState = {
    isTargetReached: false,
    question,
    positiveOption,
    negativeOption,
    targetVotes,
    telegramMessageId: poll.message_id,
    votes: [],
    statusMessageId: undefined,
  };
  await setPollState(newState);
  appEvt.post({ type: "poll_started", pollState: newState });
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
          userName: v.userName ?? MESSAGES.ANONYMOUS_NAME,
          vote: v,
        };
      } else {
        yield {
          type: "external",
          number: currentNumber++,
          index: i,
          userName: v.userName ?? MESSAGES.ANONYMOUS_NAME,
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
  const { user, option_ids } = ctx.update.poll_answer!;
  if (pollState.isTargetReached && !isAdmin(user!.id)) {
    throw new UserFacingError(ctx, MESSAGES.NO_ACTIVE_POLL);
  }
  const optionId = option_ids[0];
  if (optionId === 0) {
    const already = pollState.votes.some(
      (v) => v.userId === user!.id && v.optionId === 0,
    );
    if (already) return;
    const remaining = pollState.targetVotes -
      pollState.votes.filter((v) => v.optionId === 0).length;
    if (remaining <= 0) return;
  }
  const vote = new Vote(
    optionId,
    user!.id,
    user!.first_name || MESSAGES.ANONYMOUS_NAME,
    undefined,
    undefined,
  );
  pollState.votes.push(vote);
  await setPollState(pollState);
  appEvt.post({
    type: "vote_added",
    pollState,
    userId: user!.id,
    userName: user!.first_name || MESSAGES.ANONYMOUS_NAME,
    voteType: "direct",
  });
}

export async function addVotesBulk(
  ctx: MyContext,
  names?: string[],
  count?: number,
): Promise<string | void> {
  const pollState = await getPollState();
  if (pollState.isTargetReached && !isAdmin(ctx.from!.id)) {
    throw new UserFacingError(ctx, MESSAGES.NO_ACTIVE_POLL);
  }
  const currentVotes = pollState.votes.filter((v) => v.optionId === 0).length;
  const remaining = pollState.targetVotes - currentVotes;
  const requesterPlayerName = ctx.from?.id
    ? (await getPlayerNames([ctx.from.id])).get(ctx.from.id)
    : undefined;
  const requesterName = requesterPlayerName || ctx.from?.first_name;
  let votes: Array<Vote> = [];
  if (names && names.length) {
    votes = names.map((name) =>
      new Vote(
        0,
        undefined,
        name || MESSAGES.ANONYMOUS_NAME,
        ctx.from?.id,
        requesterName,
      )
    );
  } else if (count) {
    votes = Array(count).fill(0).map(() =>
      new Vote(
        0,
        undefined,
        MESSAGES.ANONYMOUS_NAME,
        ctx.from?.id,
        requesterName,
      )
    );
  } else {
    votes = [
      new Vote(
        0,
        undefined,
        MESSAGES.ANONYMOUS_NAME,
        ctx.from?.id,
        requesterName,
      ),
    ];
  }
  if (votes.length > remaining) {
    return MESSAGES.TOO_MANY_VOTES(votes.length, remaining);
  }
  pollState.votes.push(...votes);
  await setPollState(pollState);
  appEvt.post({
    type: "vote_added",
    pollState,
    userId: ctx.from?.id,
    userName: requesterName,
    voteType: "external",
  });
}

export async function revokeVoteByNumber(
  voteNumber: number,
  userId: number,
  isAdmin: boolean,
  ctx: MyContext,
): Promise<string> {
  const pollState = await getPollState();
  if (pollState.isTargetReached && !isAdmin) {
    throw new UserFacingError(ctx, MESSAGES.NO_ACTIVE_POLL);
  }
  if (voteNumber < 1) {
    throw new UserFacingError(ctx, MESSAGES.POLL_VOTE_NUMBER_TOO_LOW);
  }
  const votes = pollState.votes.filter((v) => v.optionId === 0);
  const vote = votes[voteNumber - 1];
  if (!vote) {
    throw new UserFacingError(ctx, MESSAGES.VOTE_NOT_FOUND(voteNumber));
  }
  if (vote.userId && !isAdmin) {
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
  }
  await setPollState(pollState);
  appEvt.post({
    type: "vote_revoked",
    pollState,
    userId: vote.requesterId,
    userName: vote.requesterName,
    voteType: "external",
  });
  let displayName = vote.userName ?? MESSAGES.ANONYMOUS_NAME;
  if (vote.userId) {
    const playerNames = await getPlayerNames([vote.userId]);
    if (playerNames.has(vote.userId)) {
      displayName = playerNames.get(vote.userId)!;
    }
  }
  return MESSAGES.VOTE_REVOKED_SUCCESS(voteNumber, displayName);
}

export async function revokeDirectVoteByUserId(
  userId: number,
  ctx: MyContext,
): Promise<void> {
  const pollState = await getPollState();
  if (pollState.isTargetReached) {
    throw new UserFacingError(ctx, MESSAGES.NO_ACTIVE_POLL);
  }
  const idx = pollState.votes.findLastIndex((v) => v.userId === userId);
  if (idx === -1) return;
  const vote = pollState.votes[idx];
  pollState.votes.splice(idx, 1);
  await setPollState(pollState);
  appEvt.post({
    type: "vote_revoked",
    pollState,
    userId: vote.userId,
    userName: vote.userName,
    voteType: "direct",
  });
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
  return !pollState.isTargetReached;
}

export async function handleVoteCommand(ctx: MyContext): Promise<void> {
  const { names, count } = parseVoteCommand(ctx);
  const pollStateBefore = await getPollState();
  const prevVotes =
    pollStateBefore.votes.filter((v) => v.optionId === 0).length;
  const result = await addVotesBulk(ctx, names, count);
  if (result) {
    await ctx.reply(result);
    return;
  }
  const pollStateAfter = await getPollState();
  const newVotes = pollStateAfter.votes.filter((v) => v.optionId === 0).length;
  const added = newVotes - prevVotes;
  if (added > 0) {
    await ctx.reply(
      MESSAGES.VOTE_ADDED(added === 1 ? "1 голос" : `${added} голосів`),
    );
  }
}

export async function handleRevokeCommand(ctx: MyContext): Promise<void> {
  const voteNumber = parseRevokeCommand(ctx);
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
  const pollStateBefore = await getPollState();
  const prevVotes =
    pollStateBefore.votes.filter((v) => v.optionId === 0).length;
  const { option_ids, user } = ctx.update.poll_answer!;
  if (option_ids.length === 0) await revokeDirectVoteByUserId(user!.id, ctx);
  switch (option_ids[0]) {
    case 0:
      await addVote(ctx);
      break;
  }
  const pollStateAfter = await getPollState();
  const newVotes = pollStateAfter.votes.filter((v) => v.optionId === 0).length;
  const added = newVotes - prevVotes;
  if (added > 0) {
    await ctx.reply(
      MESSAGES.VOTE_ADDED(added === 1 ? "1 голос" : `${added} голосів`),
    );
  }
  await updateStatusMessage();
}

export async function resetPoll(): Promise<void> {
  const pollState = await getPollState();
  if (!pollState.isTargetReached) {
    pollState.isTargetReached = true;
    await setPollState(pollState);
  }
}

export async function closePollLogic(): Promise<
  { closed: boolean; message: string }
> {
  try {
    await stopPoll();
    const pollState = await getPollState();
    if (!pollState.isTargetReached) {
      pollState.isTargetReached = true;
      await setPollState(pollState);
    }
    await updateStatusMessage();
    return { closed: true, message: MESSAGES.POLL_CLOSED_CB };
  } catch (_err) {
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

export async function sendPollCompletionMessage(): Promise<void> {
  if (!botInstance || !configInstance) throw new Error("Bot not initialized");
  await botInstance.api.sendMessage(
    configInstance.targetGroupChatId,
    MESSAGES.POLL_COMPLETION,
  );
}

export async function stopPoll(): Promise<void> {
  if (!botInstance || !configInstance) throw new Error("Bot not initialized");
  const pollState = await getPollState();
  if (pollState.telegramMessageId !== undefined) {
    await botInstance.api.stopPoll(
      configInstance.targetGroupChatId,
      pollState.telegramMessageId,
    );
  }
}

export async function updateStatusMessage(): Promise<void> {
  const pollState = await getPollState();
  const { statusMessageId: _statusMessageId } = pollState;
  if (!_statusMessageId) return;
  const statusText = await buildStatusMessage();
  await botInstance!.api.editMessageText(
    configInstance!.targetGroupChatId,
    _statusMessageId,
    statusText,
    { parse_mode: "HTML" },
  );
}

export async function createStatusMessage(): Promise<void> {
  if (!botInstance || !configInstance) throw new Error("Bot not initialized");
  const statusText = await buildStatusMessage();
  const statusMessage = await botInstance.api.sendMessage(
    configInstance.targetGroupChatId,
    statusText,
    { parse_mode: "HTML" },
  );
  const pollState = await getPollState();
  pollState.statusMessageId = statusMessage.message_id;
  await setPollState(pollState);
}
