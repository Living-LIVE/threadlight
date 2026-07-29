export type ModelProvider = "openai" | "gemini" | "gloo" | "bonfire";

const defaultModels: Record<ModelProvider, string> = {
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
  gloo: "auto",
  bonfire: "auto",
};

export function defaultModelForProvider(provider: ModelProvider): string {
  return defaultModels[provider];
}

export function modelAfterProviderChange(
  currentProvider: ModelProvider,
  currentModel: string,
  nextProvider: ModelProvider,
): string {
  return currentProvider === nextProvider ? currentModel : defaultModelForProvider(nextProvider);
}
