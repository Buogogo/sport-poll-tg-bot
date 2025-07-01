import {
  InstantPollConfig,
  PollState,
  WeeklyConfig,
} from "../constants/types.ts";

export const DEFAULT_POLL_STATE: Omit<
  PollState,
  "directVotes" | "externalVotes"
> = {
  isActive: false,
  question: "",
  positiveOption: "",
  negativeOption: "",
  targetVotes: 0,
  telegramMessageId: 0,
  votes: [],
};

export const DEFAULT_WEEKLY_CONFIG: WeeklyConfig = {
  enabled: true,
  question: "Йдемо грати в футбол цього тижня?",
  positiveOption: "Так, йду!",
  negativeOption: "Ні, не можу",
  targetVotes: 12,
  dayOfWeek: 4,
  startHour: 13,
  randomWindowMinutes: 59,
};

export const DEFAULT_INSTANT_POLL_CONFIG: InstantPollConfig = {
  question: "Йдемо грати в футбол цього тижня?",
  positiveOption: "Так, йду!",
  negativeOption: "Ні, не можу",
  targetVotes: 12,
};
