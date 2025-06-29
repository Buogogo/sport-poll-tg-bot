import { PollState } from "../constants/types.ts";
import {
  DEFAULT_INSTANT_POLL_CONFIG,
  DEFAULT_POLL_STATE,
  DEFAULT_WEEKLY_CONFIG,
} from "../constants/config.ts";
import { loadJsonFile, saveJsonFile } from "../utils/utils.ts";
import { Vote } from "../models/vote.ts";
import { configUpdateEvt, pollStateEvt } from "../events/events.ts";

const POLL_STATE_FILE = "data/poll-state.json";
const WEEKLY_CONFIG_FILE = "data/weekly-config.json";
const INSTANT_POLL_CONFIG_FILE = "data/instant-poll-config.json";

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
    loadJsonFile(POLL_STATE_FILE, {} as Partial<PollState>),
    loadJsonFile(WEEKLY_CONFIG_FILE, DEFAULT_WEEKLY_CONFIG),
    loadJsonFile(INSTANT_POLL_CONFIG_FILE, DEFAULT_INSTANT_POLL_CONFIG),
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
      saveJsonFile(POLL_STATE_FILE, event.pollState);
    }
  });
  configUpdateEvt.attach((event) => {
    const { config } = event;
    if (event.type === "weekly_config_updated") {
      saveJsonFile(WEEKLY_CONFIG_FILE, config);
    } else if (event.type === "instant_poll_config_updated") {
      saveJsonFile(INSTANT_POLL_CONFIG_FILE, config);
    }
  });
}
