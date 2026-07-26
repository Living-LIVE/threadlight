export type LaunchProvider = "openai" | "gemini" | "gloo" | "bonfire";

export function canLaunchSelectedProvider({
  provider,
  alreadyConfigured,
  credential,
}: {
  provider: LaunchProvider;
  alreadyConfigured: boolean;
  credential: string;
}): boolean {
  return provider === "openai" && (alreadyConfigured || credential.trim().length > 0);
}
