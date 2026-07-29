import { buildApp } from "./app.js";
import { createDefaultControlConfig, LocalControlStore } from "./control.js";
import { loadConfig } from "./env.js";
import { createDemoRuntime } from "./runtime.js";
import { ThreadlightRuntimeManager } from "./runtime-manager.js";

const config = loadConfig();
const controlStore = new LocalControlStore(config.THREADLIGHT_CONFIG_PATH, () =>
  createDefaultControlConfig(process.env),
);
const runtimeManager = new ThreadlightRuntimeManager(controlStore);
const runtimeStatus = async () => {
  const control = await controlStore.load();
  const discordDeployment = control.deployments.find((deployment) => deployment.kind === "discord");
  const runtime = await runtimeManager.status();
  const discord = discordDeployment
    ? runtime.deployments.find((deployment) => deployment?.id === discordDeployment.id)
    : undefined;
  return {
    discord: {
      enabled: Boolean(discordDeployment),
      ready: discord?.ready ?? false,
      state: discord?.state ?? (discordDeployment ? "starting" : "disabled"),
      participation: discord?.participation,
    },
  };
};

const app = await buildApp({
  config,
  orchestrator: createDemoRuntime(config),
  controlStore,
  runtimeManager,
  runtimeStatus,
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Threadlight is shutting down");
  await runtimeManager.stop();
  await app.close();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  await runtimeManager.initialize();
} catch (error) {
  app.log.error(
    { errorName: error instanceof Error ? error.name : "UnknownError" },
    "Threadlight failed to start",
  );
  await runtimeManager.stop();
  await app.close();
  process.exitCode = 1;
}
