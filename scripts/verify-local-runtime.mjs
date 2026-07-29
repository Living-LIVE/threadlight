const baseUrl = (process.env.THREADLIGHT_LOCAL_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const preview = process.argv.includes("--preview");

const failure = (message) => {
  console.error(`Local Threadlight verification failed: ${message}`);
  process.exitCode = 1;
};

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

const readiness = await request("/api/readiness");
if (!readiness.response.ok) failure(`/api/readiness returned ${readiness.response.status}.`);
if (readiness.body.development?.discord?.enabled !== true) failure("Discord is not enabled.");
if (readiness.body.development?.discord?.ready !== true) failure("Discord gateway is not ready.");

const status = await request("/api/control/status");
if (!status.response.ok) failure(`/api/control/status returned ${status.response.status}.`);
const discord = status.body.runtime?.deployments?.find(
  (deployment) => deployment?.id === status.body.runtime?.activeDeploymentId,
);
if (discord?.state !== "running" || discord.ready !== true) {
  failure("The configured Discord deployment is not running and ready.");
}
if (!status.body.configuration?.providers?.ai?.configured)
  failure("AI provider is not configured.");
if (!status.body.configuration?.providers?.scripture?.configured) {
  failure("Scripture provider is not configured.");
}

if (preview) {
  const result = await request("/api/control/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "I feel overwhelmed today. Could you offer a brief reflection?",
    }),
  });
  if (!result.response.ok || !result.body.reply?.message || !result.body.trace?.aiProvider) {
    failure("Saved provider preview did not return a Scripture-backed response.");
  }
  console.log(
    `Provider preview passed: ${result.body.trace.aiProvider} + ${result.body.trace.scriptureProvider}.`,
  );
}

if (!process.exitCode) console.log("Local Threadlight runtime passed.");
