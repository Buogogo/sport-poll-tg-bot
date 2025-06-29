import { PollState } from "../constants/types.ts";
import {
  DEFAULT_INSTANT_POLL_CONFIG,
  DEFAULT_POLL_STATE,
  DEFAULT_WEEKLY_CONFIG,
} from "../constants/config.ts";
import { Vote } from "../models/vote.ts";
import { configUpdateEvt, pollStateEvt } from "../events/events.ts";

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
  if (Array.isArray(loadedState.votes)) return loadedState;
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
  return { ...loadedState, votes };
}

export async function loadAll() {
  const [loadedState, weeklyConfig, instantPollConfig] = await Promise.all([
    kvGet(POLL_STATE_KEY, {} as Partial<PollState>),
    kvGet(WEEKLY_CONFIG_KEY, DEFAULT_WEEKLY_CONFIG),
    kvGet(INSTANT_POLL_CONFIG_KEY, DEFAULT_INSTANT_POLL_CONFIG),
  ]);
  const migratedState = migratePollState(loadedState);
  return {
    pollState: {
      ...DEFAULT_POLL_STATE,
      votes: [],
      ...migratedState,
    },
    weeklyConfig,
    instantPollConfig,
  };
}

export function initializeEventListeners() {
  pollStateEvt.attach((event) => {
    if (
      event.type === "poll_started" || event.type === "poll_completed" ||
      event.type === "poll_closed" || event.type === "poll_reset"
    ) {
      kvSet(POLL_STATE_KEY, event.pollState);
    }
  });
  configUpdateEvt.attach((event) => {
    const { config } = event;
    if (event.type === "weekly_config_updated") {
      kvSet(WEEKLY_CONFIG_KEY, config);
    } else if (event.type === "instant_poll_config_updated") {
      kvSet(INSTANT_POLL_CONFIG_KEY, config);
    }
  });
}
