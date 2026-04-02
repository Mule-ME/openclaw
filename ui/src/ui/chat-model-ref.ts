import type { ModelCatalogEntry } from "./types.ts";

export type ChatModelOverride =
  | {
      kind: "qualified";
      value: string;
    }
  | {
      kind: "raw";
      value: string;
    };

export type ChatModelResolutionSource = "empty" | "qualified" | "catalog" | "raw" | "server";

export type ChatModelResolutionReason = "empty" | "missing" | "ambiguous";

export type ChatModelResolution = {
  value: string;
  source: ChatModelResolutionSource;
  reason?: ChatModelResolutionReason;
};

export function buildQualifiedChatModelValue(model: string, provider?: string | null): string {
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    return "";
  }
  const trimmedProvider = provider?.trim();
  return trimmedProvider ? `${trimmedProvider}/${trimmedModel}` : trimmedModel;
}

export function createChatModelOverride(value: string): ChatModelOverride | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("/")) {
    return { kind: "qualified", value: trimmed };
  }
  return { kind: "raw", value: trimmed };
}

export function normalizeChatModelOverrideValue(
  override: ChatModelOverride | null | undefined,
  catalog: ModelCatalogEntry[],
): string {
  return resolveChatModelOverride(override, catalog).value;
}

export function resolveChatModelOverride(
  override: ChatModelOverride | null | undefined,
  catalog: ModelCatalogEntry[],
): ChatModelResolution {
  if (!override) {
    return { value: "", source: "empty", reason: "empty" };
  }
  const trimmed = override?.value.trim();
  if (!trimmed) {
    return { value: "", source: "empty", reason: "empty" };
  }
  if (override.kind === "qualified") {
    return { value: trimmed, source: "qualified" };
  }

  let matchedValue = "";
  for (const entry of catalog) {
    if (entry.id.trim().toLowerCase() !== trimmed.toLowerCase()) {
      continue;
    }
    const candidate = buildQualifiedChatModelValue(entry.id, entry.provider);
    if (!matchedValue) {
      matchedValue = candidate;
      continue;
    }
    if (matchedValue.toLowerCase() !== candidate.toLowerCase()) {
      return { value: trimmed, source: "raw", reason: "ambiguous" };
    }
  }
  if (matchedValue) {
    return { value: matchedValue, source: "catalog" };
  }
  return { value: trimmed, source: "raw", reason: "missing" };
}

export function resolveServerChatModelValue(
  model?: string | null,
  provider?: string | null,
): string {
  if (typeof model !== "string") {
    return "";
  }
  return buildQualifiedChatModelValue(model, provider);
}

export function resolvePreferredServerChatModel(
  model: string | null | undefined,
  provider: string | null | undefined,
  catalog: ModelCatalogEntry[],
): ChatModelResolution {
  if (typeof model !== "string") {
    return { value: "", source: "empty", reason: "empty" };
  }
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    return { value: "", source: "empty", reason: "empty" };
  }

  const trimmedProvider = provider?.trim();
  const overrideResolution = resolveChatModelOverride(
    trimmedProvider ? { kind: "raw", value: trimmedModel } : createChatModelOverride(trimmedModel),
    catalog,
  );
  if (overrideResolution.source === "qualified" || overrideResolution.source === "catalog") {
    return overrideResolution;
  }

  return {
    value: resolveServerChatModelValue(trimmedModel, trimmedProvider),
    source: "server",
    reason: overrideResolution.reason,
  };
}

export function resolvePreferredServerChatModelValue(
  model: string | null | undefined,
  provider: string | null | undefined,
  catalog: ModelCatalogEntry[],
): string {
  return resolvePreferredServerChatModel(model, provider, catalog).value;
}

export function formatChatModelDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const separator = trimmed.indexOf("/");
  if (separator <= 0) {
    return trimmed;
  }
  return `${trimmed.slice(separator + 1)} · ${trimmed.slice(0, separator)}`;
}

function formatRawCatalogLabel(entry: ModelCatalogEntry): string {
  const provider = entry.provider?.trim();
  return provider ? `${entry.id} · ${provider}` : entry.id;
}

function hasCatalogNameCollision(entry: ModelCatalogEntry, catalog: ModelCatalogEntry[]): boolean {
  const name = entry.name.trim();
  if (!name) {
    return false;
  }

  const normalizedName = name.toLowerCase();
  const entryValue = buildQualifiedChatModelValue(entry.id, entry.provider).trim().toLowerCase();
  for (const candidate of catalog) {
    if (candidate.name.trim().toLowerCase() !== normalizedName) {
      continue;
    }
    const candidateValue = buildQualifiedChatModelValue(candidate.id, candidate.provider)
      .trim()
      .toLowerCase();
    if (candidateValue !== entryValue) {
      return true;
    }
  }
  return false;
}

function formatCatalogEntryDisplay(entry: ModelCatalogEntry, catalog: ModelCatalogEntry[]): string {
  const name = entry.name.trim();
  if (!name) {
    return formatRawCatalogLabel(entry);
  }

  if (!hasCatalogNameCollision(entry, catalog)) {
    return name;
  }

  const provider = entry.provider?.trim();
  return provider ? `${name} · ${provider}` : `${name} · ${entry.id}`;
}

export function formatCatalogChatModelDisplay(value: string, catalog: ModelCatalogEntry[]): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.toLowerCase();
  for (const entry of catalog) {
    const candidate = buildQualifiedChatModelValue(entry.id, entry.provider).trim().toLowerCase();
    if (candidate !== normalized) {
      continue;
    }
    return formatCatalogEntryDisplay(entry, catalog);
  }

  return formatChatModelDisplay(trimmed);
}

export function buildChatModelOption(
  entry: ModelCatalogEntry,
  catalog: ModelCatalogEntry[] = [entry],
): { value: string; label: string } {
  const provider = entry.provider?.trim();
  return {
    value: buildQualifiedChatModelValue(entry.id, provider),
    label: formatCatalogEntryDisplay(entry, catalog),
  };
}
