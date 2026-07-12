export interface ChatMarkdownSettings {
  italic?: boolean;
  bold?: boolean;
  boldItalic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  links?: boolean;
  headers?: boolean;
  subtext?: boolean;
  lists?: boolean;
  quotes?: boolean;
  code?: boolean;
  inlineCode?: boolean;
  codeBlocks?: boolean;
}

export type ResolvedChatMarkdownSettings = Required<ChatMarkdownSettings>;

export type ChatMarkdownToggleKey = Exclude<keyof ChatMarkdownSettings, "code">;

export const DEFAULT_CHAT_MARKDOWN_SETTINGS = {
  italic: true,
  bold: true,
  boldItalic: true,
  underline: true,
  strikethrough: true,
  links: true,
  headers: true,
  subtext: true,
  lists: true,
  quotes: true,
  code: true,
  inlineCode: true,
  codeBlocks: true,
} satisfies ResolvedChatMarkdownSettings;

export const CHAT_MARKDOWN_SETTING_KEYS = [
  "bold",
  "italic",
  "boldItalic",
  "underline",
  "strikethrough",
  "links",
  "headers",
  "subtext",
  "lists",
  "quotes",
  "inlineCode",
  "codeBlocks",
] as const satisfies ChatMarkdownToggleKey[];

export function resolveChatMarkdownSettings(settings: unknown): ResolvedChatMarkdownSettings {
  if (!isSettingsRecord(settings)) {
    return { ...DEFAULT_CHAT_MARKDOWN_SETTINGS };
  }

  const code = readBoolean(settings.code, DEFAULT_CHAT_MARKDOWN_SETTINGS.code);

  return {
    italic: readBoolean(settings.italic, DEFAULT_CHAT_MARKDOWN_SETTINGS.italic),
    bold: readBoolean(settings.bold, DEFAULT_CHAT_MARKDOWN_SETTINGS.bold),
    boldItalic: readBoolean(settings.boldItalic, DEFAULT_CHAT_MARKDOWN_SETTINGS.boldItalic),
    underline: readBoolean(settings.underline, DEFAULT_CHAT_MARKDOWN_SETTINGS.underline),
    strikethrough: readBoolean(settings.strikethrough, DEFAULT_CHAT_MARKDOWN_SETTINGS.strikethrough),
    links: readBoolean(settings.links, DEFAULT_CHAT_MARKDOWN_SETTINGS.links),
    headers: readBoolean(settings.headers, DEFAULT_CHAT_MARKDOWN_SETTINGS.headers),
    subtext: readBoolean(settings.subtext, DEFAULT_CHAT_MARKDOWN_SETTINGS.subtext),
    lists: readBoolean(settings.lists, DEFAULT_CHAT_MARKDOWN_SETTINGS.lists),
    quotes: readBoolean(settings.quotes, DEFAULT_CHAT_MARKDOWN_SETTINGS.quotes),
    code,
    inlineCode: readBoolean(settings.inlineCode, code),
    codeBlocks: readBoolean(settings.codeBlocks, code),
  };
}

export async function getChatMarkdownSettingsForUser(
  supabase: { from: (table: "profiles") => any },
  userId: string
) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("chat_markdown_settings")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return resolveChatMarkdownSettings(null);
    }

    return resolveChatMarkdownSettings(data?.chat_markdown_settings);
  } catch {
    return resolveChatMarkdownSettings(null);
  }
}

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
