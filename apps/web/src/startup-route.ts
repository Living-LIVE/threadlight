type Deployment = {
  id: string;
  kind: "discord" | "slack" | "youtube-comments" | "teams" | "twitch";
  state: "draft" | "running" | "paused" | "error";
  youtube?: { channelId?: string; refreshTokenConfigured: boolean };
};

export type StartupRoute = {
  screen: "home" | "choose" | "connect" | "launch";
  selectedId?: string;
  notice?: string;
};

export function resolveStartupRoute(
  deployments: Deployment[],
  youtubeResult: "connected" | "connection-failed" | undefined,
): StartupRoute {
  const connectedYouTube = deployments.find(
    (deployment) =>
      deployment.kind === "youtube-comments" &&
      deployment.youtube?.channelId &&
      deployment.youtube.refreshTokenConfigured,
  );
  if (youtubeResult === "connected" && connectedYouTube) {
    return {
      screen: "launch",
      selectedId: connectedYouTube.id,
      notice: `YouTube connected to ${connectedYouTube.youtube?.channelId}. Choose Threadlight's model to finish setup.`,
    };
  }
  if (youtubeResult === "connection-failed") {
    const youtube = deployments.find((deployment) => deployment.kind === "youtube-comments");
    return {
      screen: youtube ? "connect" : deployments.length ? "home" : "choose",
      ...(youtube ? { selectedId: youtube.id } : {}),
      notice:
        "YouTube could not connect. Check the OAuth client and authorized callback URL, then try again.",
    };
  }
  const incompleteDiscord = deployments.find(
    (deployment) =>
      deployment.kind === "discord" &&
      (deployment.state === "draft" || deployment.state === "error"),
  );
  if (incompleteDiscord) return { screen: "connect", selectedId: incompleteDiscord.id };
  return { screen: deployments.length ? "home" : "choose" };
}
