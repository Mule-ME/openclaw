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
  if (!override) {
    return "";
  }
  const trimmed = override?.value.trim();
  if (!trimmed) {
    return "";
  }
  if (override.kind === "qualified") {
    return trimmed;
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
      return trimmed;
    }
  }
  return matchedValue || trimmed;
}

export function resolveServerChatModelValue(
  model?: string | null,
  provider?: string | null,
): string {
  if (typeof model !== "string") {
    return "";
  }
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    return "";
  }
  const trimmedProvider = provider?.trim();
  if (!trimmedProvider) {
    return trimmedModel;
  }
  const providerPrefix = `${trimmedProvider.toLowerCase()}/`;
  return trimmedModel.toLowerCase().startsWith(providerPrefix)
    ? trimmedModel
    : buildQualifiedChatModelValue(trimmedModel, trimmedProvider);
}

export function resolvePreferredServerChatModelValue(
  model: string | null | undefined,
  provider: string | null | undefined,
  catalog: ModelCatalogEntry[],
): string {
  if (typeof model !== "string") {
    return "";
  }
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    return "";
  }

  const trimmedProvider = provider?.trim();

  if (trimmedProvider) {
    return resolveServerChatModelValue(trimmedModel, trimmedProvider);
  }

  return normalizeChatModelOverrideValue(createChatModelOverride(trimmedModel), catalog);
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

function resolveCatalogDisplayName(entry: ModelCatalogEntry): string {
  return entry.alias?.trim() || entry.name.trim();
}

function createQualifiedCatalogKey(entry: ModelCatalogEntry): string {
  return buildQualifiedChatModelValue(entry.id, entry.provider).trim().toLowerCase();
}

function createNameProviderKey(name: string, provider?: string | null): string {
  return `${name.toLowerCase()}\u0000${provider?.trim().toLowerCase() ?? ""}`;
}

export type ChatModelDisplayLookup = ReadonlyMap<string, string>;

export function buildCatalogDisplayLookup(catalog: ModelCatalogEntry[]): Map<string, string> {
  const nameToValues = new Map<string, Set<string>>();
  const nameProviderToValues = new Map<string, Set<string>>();

  for (const entry of catalog) {
    const name = resolveCatalogDisplayName(entry);
    if (!name) {
      continue;
    }

    const qualifiedKey = createQualifiedCatalogKey(entry);
    const normalizedName = name.toLowerCase();
    const providerKey = createNameProviderKey(name, entry.provider);

    const nameValues = nameToValues.get(normalizedName) ?? new Set<string>();
    nameValues.add(qualifiedKey);
    nameToValues.set(normalizedName, nameValues);

    const nameProviderValues = nameProviderToValues.get(providerKey) ?? new Set<string>();
    nameProviderValues.add(qualifiedKey);
    nameProviderToValues.set(providerKey, nameProviderValues);
  }

  const displayLookup = new Map<string, string>();
  for (const entry of catalog) {
    const qualifiedKey = createQualifiedCatalogKey(entry);
    const name = resolveCatalogDisplayName(entry);
    if (!name) {
      displayLookup.set(qualifiedKey, formatRawCatalogLabel(entry));
      continue;
    }

    const normalizedName = name.toLowerCase();
    if ((nameToValues.get(normalizedName)?.size ?? 0) <= 1) {
      displayLookup.set(qualifiedKey, name);
      continue;
    }

    const provider = entry.provider?.trim();
    if ((nameProviderToValues.get(createNameProviderKey(name, provider))?.size ?? 0) <= 1) {
      displayLookup.set(qualifiedKey, provider ? `${name} · ${provider}` : `${name} · ${entry.id}`);
      continue;
    }

    displayLookup.set(qualifiedKey, `${name} · ${formatRawCatalogLabel(entry)}`);
  }

  return displayLookup;
}

export function formatCatalogEntryDisplay(
  entry: ModelCatalogEntry,
  displayLookup: ChatModelDisplayLookup,
): string {
  return displayLookup.get(createQualifiedCatalogKey(entry)) ?? formatRawCatalogLabel(entry);
}

export function formatCatalogChatModelDisplayFromLookup(
  value: string,
  displayLookup: ChatModelDisplayLookup,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return displayLookup.get(trimmed.toLowerCase()) ?? formatChatModelDisplay(trimmed);
}

export function formatCatalogChatModelDisplay(value: string, catalog: ModelCatalogEntry[]): string {
  return formatCatalogChatModelDisplayFromLookup(value, buildCatalogDisplayLookup(catalog));
}

export function buildChatModelOption(
  entry: ModelCatalogEntry,
  catalog: ModelCatalogEntry[] = [entry],
): { value: string; label: string } {
  return buildChatModelOptionFromLookup(entry, buildCatalogDisplayLookup(catalog));
}

export function buildChatModelOptionFromLookup(
  entry: ModelCatalogEntry,
  displayLookup: ChatModelDisplayLookup,
): { value: string; label: string } {
  const provider = entry.provider?.trim();
  return {
    value: buildQualifiedChatModelValue(entry.id, provider),
    label: formatCatalogEntryDisplay(entry, displayLookup),
  };
}
