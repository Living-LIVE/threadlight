import { DEMO_SCENARIOS } from "@threadlight/core";
import { loadConfig } from "./env.js";
import { createThreadlightRuntime } from "./runtime.js";

const config = loadConfig();
const scenario = DEMO_SCENARIOS.find((candidate) => candidate.id === "grief");
if (!scenario) throw new Error("The grief smoke scenario is missing");

const runtime = createThreadlightRuntime(config);
const result = await runtime.respond({
  context: {
    channelId: "smoke:providers",
    roomName: scenario.roomName,
    messages: scenario.messages,
  },
  prompt: scenario.suggestedPrompt,
  source: "demo",
});

console.log(
  JSON.stringify(
    {
      decision: {
        action: result.decision.action,
        riskLevel: result.decision.riskLevel,
      },
      replyPresent: Boolean(result.reply?.message),
      passage: result.reply?.passage
        ? {
            reference: result.reply.passage.reference,
            translation: result.reply.passage.translation,
            attributed: Boolean(result.reply.passage.attribution),
          }
        : null,
      providers: {
        ai: result.trace.aiProvider,
        scripture: result.trace.scriptureProvider,
      },
      steps: result.trace.steps.map((step) => ({
        name: step.name,
        status: step.status,
      })),
    },
    null,
    2,
  ),
);

if (!result.reply?.message || !result.reply.passage) {
  process.exitCode = 1;
}
