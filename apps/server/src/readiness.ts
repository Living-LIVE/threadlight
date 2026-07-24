import { competitionReadiness, loadConfig } from "./env.js";

const config = loadConfig();
const readiness = competitionReadiness(config);

console.log(
  JSON.stringify(
    {
      development: {
        discord: config.DISCORD_ENABLED,
        aiProvider: config.AI_PROVIDER,
        scriptureProvider: config.SCRIPTURE_PROVIDER,
      },
      competition: readiness,
      readyForCompetitionSubmission: readiness.gloo && readiness.youVersion,
    },
    null,
    2,
  ),
);

if (!readiness.gloo || !readiness.youVersion) {
  process.exitCode = 2;
}
