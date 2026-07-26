export type LaunchProvider = "openai" | "gemini" | "gloo" | "bonfire";

export function canLaunchSelectedProvider({
  provider,
  alreadyConfigured,
  credential,
  identity = "",
}: {
  provider: LaunchProvider;
  alreadyConfigured: boolean;
  credential: string;
  identity?: string;
}): boolean {
  if (alreadyConfigured) return provider === "openai" || provider === "gloo";
  if (provider === "openai") return credential.trim().length > 0;
  if (provider === "gloo") return identity.trim().length > 0 && credential.trim().length > 0;
  return false;
}
