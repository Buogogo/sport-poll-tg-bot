import {
  InstantPollConfig,
  PollState,
  WeeklyConfig,
} from "../constants/types.ts";
import {
  DEFAULT_INSTANT_POLL_CONFIG,
  DEFAULT_POLL_STATE,
  DEFAULT_WEEKLY_CONFIG,
} from "../constants/config.ts";
import { Vote } from "../models/vote.ts";

// Deno KV keys
const POLL_STATE_KEY = ["poll-state"];
const WEEKLY_CONFIG_KEY = ["weekly-config"];
const INSTANT_POLL_CONFIG_KEY = ["instant-poll-config"];

async function kvGet<T>(key: Deno.KvKey, defaultValue: T): Promise<T> {
  const kv = await Deno.openKv();
  const res = await kv.get<T>(key);
  return res.value ?? defaultValue;
}

async function kvSet<T>(key: Deno.KvKey, value: T): Promise<void> {
  const kv = await Deno.openKv();
  await kv.set(key, value);
}

function migratePollState(loadedState: Record<string, unknown>) {
  // Handle legacy isActive to targetReached migration
  if (typeof loadedState.isActive === "boolean") {
    loadedState.targetReached = !loadedState.isActive;
    delete loadedState.isActive;
  }
  
  if (Array.isArray(loadedState.votes)) {
    if (typeof loadedState.telegramMessageId !== "number") {
      return { ...loadedState, telegramMessageId: 0 };
    }
    return loadedState;
  }
  const votes: Vote[] = [];
  if (loadedState.directVotes && typeof loadedState.directVotes === "object") {
    const directVotes = loadedState.directVotes as Record<
      string,
      { userId: number; userName: string; optionId: number }
    >;
    for (const k in directVotes) {
      const v = directVotes[k];
      votes.push(new Vote(v.optionId, v.userId, v.userName));
    }
  }
  if (Array.isArray(loadedState.externalVotes)) {
    const externalVotes = loadedState.externalVotes as Array<
      { requesterId: number; requesterName: string }
    >;
    for (const v of externalVotes) {
      votes.push(
        new Vote(
          0,
          undefined,
          undefined,
          v.requesterId,
          v.requesterName,
        ),
      );
    }
  }
  return { ...loadedState, votes, telegramMessageId: 0 };
}

export async function getPollState(): Promise<PollState> {
  const loadedState = await kvGet(POLL_STATE_KEY, {} as Partial<PollState>);
  const migratedState = migratePollState(loadedState);
  return {
    ...DEFAULT_POLL_STATE,
    votes: [],
    ...migratedState,
  };
}

export async function setPollState(state: PollState): Promise<void> {
  await kvSet(POLL_STATE_KEY, state);
}

export async function getWeeklyConfig(): Promise<WeeklyConfig> {
  return await kvGet(WEEKLY_CONFIG_KEY, DEFAULT_WEEKLY_CONFIG);
}

export async function setWeeklyConfig(config: WeeklyConfig): Promise<void> {
  await kvSet(WEEKLY_CONFIG_KEY, config);
}

export async function getInstantPollConfig(): Promise<InstantPollConfig> {
  return await kvGet(INSTANT_POLL_CONFIG_KEY, DEFAULT_INSTANT_POLL_CONFIG);
}

export async function setInstantPollConfig(
  config: InstantPollConfig,
): Promise<void> {
  await kvSet(INSTANT_POLL_CONFIG_KEY, config);
}
