import type { ConversationMessage } from "./types.js";

export type DemoScenario = {
  id: string;
  label: string;
  summary: string;
  roomName: string;
  suggestedPrompt: string;
  messages: ConversationMessage[];
};

const now = new Date("2026-07-24T15:00:00.000Z");

function at(minutes: number) {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "grief",
    label: "Grief",
    summary: "A quiet admission after everyone else has moved on.",
    roomName: "Live Tapestry",
    suggestedPrompt: "I keep telling everyone I am okay, but the house feels impossibly empty.",
    messages: [
      {
        id: "grief-1",
        author: { id: "maya", name: "Maya" },
        content: "Thanks for staying on after the stream. How is everyone really doing?",
        createdAt: at(0),
      },
      {
        id: "grief-2",
        author: { id: "eli", name: "Eli" },
        content: "Work has been a lot, but I am hanging in there.",
        createdAt: at(1),
      },
      {
        id: "grief-3",
        author: { id: "jordan", name: "Jordan" },
        content: "I keep telling everyone I am okay, but the house feels impossibly empty.",
        createdAt: at(2),
      },
    ],
  },
  {
    id: "conflict",
    label: "Conflict",
    summary: "A tense volunteer conversation needs a slower response.",
    roomName: "Volunteer Team",
    suggestedPrompt: "I am frustrated and I do not want to send something I will regret.",
    messages: [
      {
        id: "conflict-1",
        author: { id: "nora", name: "Nora" },
        content: "We changed the schedule again and nobody told the setup team.",
        createdAt: at(0),
      },
      {
        id: "conflict-2",
        author: { id: "marcus", name: "Marcus" },
        content: "That is not what happened. We posted it Tuesday.",
        createdAt: at(1),
      },
      {
        id: "conflict-3",
        author: { id: "nora", name: "Nora" },
        content: "I am frustrated and I do not want to send something I will regret.",
        createdAt: at(2),
      },
    ],
  },
  {
    id: "encouragement",
    label: "Encouragement",
    summary: "A small win becomes a moment of gratitude.",
    roomName: "Creator Community",
    suggestedPrompt: "Today was the first time I shared my story without feeling ashamed.",
    messages: [
      {
        id: "encouragement-1",
        author: { id: "sam", name: "Sam" },
        content: "That conversation after the stream was worth everything.",
        createdAt: at(0),
      },
      {
        id: "encouragement-2",
        author: { id: "riley", name: "Riley" },
        content: "Today was the first time I shared my story without feeling ashamed.",
        createdAt: at(1),
      },
    ],
  },
  {
    id: "prayer",
    label: "Prayer",
    summary: "A community member asks for prayer before a difficult appointment.",
    roomName: "Prayer Room",
    suggestedPrompt: "My appointment is tomorrow morning. Would you pray for peace and courage?",
    messages: [
      {
        id: "prayer-1",
        author: { id: "avery", name: "Avery" },
        content: "Checking in before we sign off. Anything we can carry with you this week?",
        createdAt: at(0),
      },
      {
        id: "prayer-2",
        author: { id: "devon", name: "Devon" },
        content: "My appointment is tomorrow morning. Would you pray for peace and courage?",
        createdAt: at(1),
      },
    ],
  },
];
