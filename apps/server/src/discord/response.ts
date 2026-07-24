import type { ThreadlightResult } from "@threadlight/core";
import { EmbedBuilder } from "discord.js";

const EMBED_COLOR = 0x8c735a;
const MAX_DESCRIPTION_LENGTH = 4_096;
const MAX_FIELD_LENGTH = 1_024;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clip(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return undefined;
}

function isSafeHttpUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function formatThreadlightResponse(result: ThreadlightResult): EmbedBuilder[] {
  if (!result.reply) return [];

  const data = asRecord(result.reply);
  const passage = asRecord(data.passage);
  const message = firstText(data.message, data.response, data.reflection) ?? "";
  const reference = firstText(passage.reference, passage.ref, passage.label);
  const passageText = firstText(passage.text, passage.content);
  const translation = firstText(passage.translation, passage.version);
  const attribution = firstText(passage.attribution, passage.credit);
  const prayer = firstText(data.prayer, data.prayerPrompt);
  const carePrompt = firstText(data.carePrompt, data.care, data.nextStep);
  const sourceLink = firstText(
    passage.sourceLink,
    passage.sourceUrl,
    passage.url,
    data.sourceLink,
    data.sourceUrl,
  );

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      clip(message || "I do not have a response to share yet.", MAX_DESCRIPTION_LENGTH),
    );

  if (reference || passageText) {
    const passageValue = [reference, passageText].filter(Boolean).join("\n\n");
    embed.addFields({ name: "Passage", value: clip(passageValue, MAX_FIELD_LENGTH) });
  }

  if (translation) {
    embed.addFields({
      name: "Translation",
      value: clip(translation, MAX_FIELD_LENGTH),
      inline: true,
    });
  }

  if (attribution) {
    embed.addFields({
      name: "Attribution",
      value: clip(attribution, MAX_FIELD_LENGTH),
      inline: true,
    });
  }

  if (prayer) {
    embed.addFields({ name: "Prayer", value: clip(prayer, MAX_FIELD_LENGTH) });
  }

  if (carePrompt) {
    embed.addFields({ name: "A gentle next step", value: clip(carePrompt, MAX_FIELD_LENGTH) });
  }

  if (isSafeHttpUrl(sourceLink)) {
    embed.setURL(sourceLink);
    embed.setFooter({ text: "Read the source passage" });
  }

  return [embed];
}

export const formatResponseEmbeds = formatThreadlightResponse;
