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
      const pollState = { ...event.pollState, isActive: false };
      await pollService.setPollState(pollState);
      await sendPollCompletionMessage();
      await updateStatusMessage();
      return;
    } else if (event.type === "poll_reset") {
      await pollService.setPollState(event.pollState);
      await updateStatusMessage();
      return;
    } else if (event.type === "poll_closed") {
      await pollService.setPollState(event.pollState);
      await updateStatusMessage();
      // Optionally, send a notification or message if needed
      return;
    }
    await updateStatusMessage();
  });
  // Add listener for vote events to update status message
  pollVoteEvt.attach(async () => {
    // Always update the status message after a vote
    await updateStatusMessage();
    // Check for poll completion and handle it if needed
    const pollState = await pollService.getPollState();
    const currentVotes = pollState.votes.filter((v) => v.optionId === 0).length;
    if (pollState.isActive && currentVotes >= pollState.targetVotes) {
      // 1. Close the poll in Telegram
      await stopPoll();
      // 2. Set poll to inactive and save
      pollState.isActive = false;
      await pollService.setPollState(pollState);
      // 3. Send completion message and update status
      await sendPollCompletionMessage();
      await updateStatusMessage();
    }
  });
}
