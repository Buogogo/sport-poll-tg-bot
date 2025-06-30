import { Bot } from "grammy";
import { MyContext } from "../middleware/session.ts";
import { pollStateEvt, pollVoteEvt } from "../events/events.ts";
import * as pollService from "./poll-service.ts";
import { MESSAGES } from "../constants/messages.ts";

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

export async function updateStatusMessage(): Promise<void> {
  if (!botInstance || !configInstance) return;

  const pollState = await pollService.getPollState();
  const { statusMessageId } = pollState;
  if (!statusMessageId) return;

  const statusText = await pollService.buildStatusMessage();
  await botInstance.api.editMessageText(
    configInstance.targetGroupChatId,
    statusMessageId,
    statusText,
    { parse_mode: "Markdown" },
  );
}

export async function createStatusMessage(): Promise<void> {
  if (!botInstance || !configInstance) return;
  const statusMessage = await botInstance.api.sendMessage(
    configInstance.targetGroupChatId,
    await pollService.buildStatusMessage(),
    { parse_mode: "Markdown" },
  );
  const pollState = await pollService.getPollState();
  pollState.statusMessageId = statusMessage.message_id;
  await pollService.setPollState(pollState);
}

export async function sendPollCompletionMessage(): Promise<void> {
  if (!botInstance || !configInstance) return;
  await botInstance.api.sendMessage(
    configInstance.targetGroupChatId,
    MESSAGES.POLL_COMPLETION,
  );
}

export async function stopPoll(): Promise<void> {
  if (!botInstance || !configInstance) return;
  const pollState = await pollService.getPollState();
  if (pollState.telegramMessageId !== undefined) {
    await botInstance.api.stopPoll(
      configInstance.targetGroupChatId,
      pollState.telegramMessageId,
    );
  }
}

export function initializeEventListeners() {
  pollStateEvt.attach(async (event) => {
    if (event.type === "poll_started") {
      await createStatusMessage();
      return;
    } else if (event.type === "poll_completed") {
      await stopPoll();
      await sendPollCompletionMessage();
    }
    await updateStatusMessage();
  });
  // Add listener for vote events to update status message
  pollVoteEvt.attach(async (event) => {
    if (event.type === "vote_added" || event.type === "vote_revoked") {
      await updateStatusMessage();
    }
  });
}
