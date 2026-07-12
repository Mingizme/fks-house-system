import type { ReactNode } from "react";
import {
  resolveChatMarkdownSettings,
  type ChatMarkdownSettings,
  type ResolvedChatMarkdownSettings,
} from "@/lib/chat-markdown-settings";

export type { ChatMarkdownSettings } from "@/lib/chat-markdown-settings";

interface ChatMarkdownProps {
  content: string;
  settings?: ChatMarkdownSettings | null;
}

type InlineMatch = {
  node: ReactNode;
  nextIndex: number;
};

type ListLine = {
  level: number;
  content: string;
};

type ListNode = {
  content: string;
  children: ListNode[];
};

export default function ChatMarkdown({ content, settings }: ChatMarkdownProps) {
  const resolvedSettings = resolveChatMarkdownSettings(settings);

  return <>{renderBlocks(content, resolvedSettings, "chat-md")}</>;
}

function renderBlocks(
  content: string,
  settings: ResolvedChatMarkdownSettings,
  keyPrefix: string
): ReactNode[] {
  const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedContent.split("\n");
  const nodes: ReactNode[] = [];
  let lineIndex = 0;
  let nodeIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const codeFence = readCodeFence(lines, lineIndex);

    if (codeFence) {
      const key = `${keyPrefix}-code-${nodeIndex++}`;
      if (settings.codeBlocks) {
        nodes.push(
          <pre
            key={key}
            className="my-1 max-w-full overflow-x-auto rounded-md bg-black/25 px-3 py-2 font-mono text-xs leading-5 text-current whitespace-pre-wrap"
          >
            <code>{codeFence.code}</code>
          </pre>
        );
      } else {
        nodes.push(codeFence.raw + (codeFence.nextIndex < lines.length ? "\n" : ""));
      }
      if (settings.codeBlocks && codeFence.trailing) {
        nodes.push(...renderInlineLines([codeFence.trailing], settings, `${key}-trailing`));
      }
      lineIndex = codeFence.nextIndex;
      continue;
    }

    if (settings.quotes && line.startsWith(">>> ")) {
      nodes.push(
        renderQuoteBlock(
          [line.slice(4), ...lines.slice(lineIndex + 1)],
          settings,
          `${keyPrefix}-quote-${nodeIndex++}`
        )
      );
      break;
    }

    if (settings.quotes && line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (lineIndex < lines.length && lines[lineIndex].startsWith("> ")) {
        quoteLines.push(lines[lineIndex].slice(2));
        lineIndex += 1;
      }
      nodes.push(renderQuoteBlock(quoteLines, settings, `${keyPrefix}-quote-${nodeIndex++}`));
      continue;
    }

    const heading = settings.headers ? readHeading(line) : null;
    if (heading) {
      nodes.push(renderHeading(heading.level, heading.content, settings, `${keyPrefix}-heading-${nodeIndex++}`));
      lineIndex += 1;
      continue;
    }

    const subtext = settings.subtext ? readSubtext(line) : null;
    if (subtext !== null) {
      nodes.push(
        <div key={`${keyPrefix}-subtext-${nodeIndex++}`} className="my-0.5 text-xs leading-relaxed opacity-70">
          {parseInline(subtext, settings, `${keyPrefix}-subtext-inline-${nodeIndex}`)}
        </div>
      );
      lineIndex += 1;
      continue;
    }

    const listLine = settings.lists ? readListLine(line) : null;
    if (listLine) {
      const listLines: ListLine[] = [];
      while (lineIndex < lines.length) {
        const currentListLine = readListLine(lines[lineIndex]);
        if (!currentListLine) {
          break;
        }
        listLines.push(currentListLine);
        lineIndex += 1;
      }
      nodes.push(renderList(listLines, settings, `${keyPrefix}-list-${nodeIndex++}`));
      continue;
    }

    const paragraphLines: string[] = [];
    while (lineIndex < lines.length && !isBlockStart(lines[lineIndex], settings)) {
      paragraphLines.push(lines[lineIndex]);
      lineIndex += 1;
    }

    if (paragraphLines.length > 0) {
      nodes.push(...renderInlineLines(paragraphLines, settings, `${keyPrefix}-paragraph-${nodeIndex++}`));
    }
  }

  return nodes;
}

function isBlockStart(line: string, settings: ResolvedChatMarkdownSettings) {
  return (
    line.startsWith("```") ||
    (settings.quotes && (line.startsWith(">>> ") || line.startsWith("> "))) ||
    (settings.headers && readHeading(line) !== null) ||
    (settings.subtext && readSubtext(line) !== null) ||
    (settings.lists && readListLine(line) !== null)
  );
}

function readCodeFence(lines: string[], startIndex: number) {
  const openingLine = lines[startIndex];
  if (!openingLine.startsWith("```")) {
    return null;
  }

  const sameLineEndIndex = openingLine.indexOf("```", 3);
  if (sameLineEndIndex !== -1) {
    return {
      code: openingLine.slice(3, sameLineEndIndex),
      raw: openingLine,
      trailing: openingLine.slice(sameLineEndIndex + 3),
      nextIndex: startIndex + 1,
    };
  }

  const codeLines: string[] = [];
  const rawLines = [openingLine];
  let lineIndex = startIndex + 1;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (line.startsWith("```")) {
      rawLines.push(line);
      lineIndex += 1;
      break;
    }

    codeLines.push(line);
    rawLines.push(line);
    lineIndex += 1;
  }

  return {
    code: codeLines.join("\n"),
    raw: rawLines.join("\n"),
    nextIndex: lineIndex,
  };
}

function readHeading(line: string) {
  const match = /^(#{1,3}) (.+)$/.exec(line);
  if (!match) {
    return null;
  }

  return {
    level: match[1].length,
    content: match[2],
  };
}

function readSubtext(line: string) {
  const match = /^-# (.+)$/.exec(line);

  return match ? match[1] : null;
}

function readListLine(line: string): ListLine | null {
  const match = /^( *)([-*]) (.*)$/.exec(line);
  if (!match || match[1].length % 2 !== 0) {
    return null;
  }

  return {
    level: match[1].length / 2,
    content: match[3],
  };
}

function renderHeading(
  level: number,
  content: string,
  settings: ResolvedChatMarkdownSettings,
  key: string
) {
  const children = parseInline(content, settings, `${key}-inline`);

  if (level === 1) {
    return (
      <h1 key={key} className="my-0.5 text-lg font-bold leading-snug">
        {children}
      </h1>
    );
  }

  if (level === 2) {
    return (
      <h2 key={key} className="my-0.5 text-base font-bold leading-snug">
        {children}
      </h2>
    );
  }

  return (
    <h3 key={key} className="my-0.5 text-sm font-bold leading-snug lg:text-base">
      {children}
    </h3>
  );
}

function renderQuoteBlock(
  lines: string[],
  settings: ResolvedChatMarkdownSettings,
  key: string
) {
  return (
    <blockquote key={key} className="my-1 border-l-4 border-white/30 pl-3 opacity-90">
      {renderInlineLines(lines, settings, `${key}-inline`)}
    </blockquote>
  );
}

function renderList(
  lines: ListLine[],
  settings: ResolvedChatMarkdownSettings,
  key: string
) {
  const rootNodes: ListNode[] = [];
  const latestAtLevel: ListNode[] = [];

  for (const line of lines) {
    const node: ListNode = {
      content: line.content,
      children: [],
    };

    if (line.level === 0 || !latestAtLevel[line.level - 1]) {
      rootNodes.push(node);
    } else {
      latestAtLevel[line.level - 1].children.push(node);
    }

    latestAtLevel[line.level] = node;
    latestAtLevel.length = line.level + 1;
  }

  return (
    <ul key={key} className="my-1 list-disc space-y-0.5 pl-5">
      {renderListNodes(rootNodes, settings, key)}
    </ul>
  );
}

function renderListNodes(
  nodes: ListNode[],
  settings: ResolvedChatMarkdownSettings,
  keyPrefix: string
) {
  return nodes.map((node, index) => (
    <li key={`${keyPrefix}-item-${index}`}>
      <span>{parseInline(node.content, settings, `${keyPrefix}-item-${index}-inline`)}</span>
      {node.children.length > 0 && (
        <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
          {renderListNodes(node.children, settings, `${keyPrefix}-item-${index}`)}
        </ul>
      )}
    </li>
  ));
}

function renderInlineLines(
  lines: string[],
  settings: ResolvedChatMarkdownSettings,
  keyPrefix: string
): ReactNode[] {
  if (lines.length === 1 && lines[0] === "") {
    return [<br key={`${keyPrefix}-blank`} />];
  }

  return lines.flatMap((line, index) => {
    const nodes: ReactNode[] = [];
    if (index > 0) {
      nodes.push(<br key={`${keyPrefix}-break-${index}`} />);
    }
    nodes.push(...parseInline(line, settings, `${keyPrefix}-line-${index}`));
    return nodes;
  });
}

function parseInline(
  text: string,
  settings: ResolvedChatMarkdownSettings,
  keyPrefix: string
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let cursor = 0;
  let tokenIndex = 0;

  const flushBuffer = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = "";
    }
  };

  while (cursor < text.length) {
    const match = readInlineToken(text, cursor, settings, `${keyPrefix}-token-${tokenIndex}`);
    if (match) {
      flushBuffer();
      nodes.push(match.node);
      cursor = match.nextIndex;
      tokenIndex += 1;
      continue;
    }

    buffer += text[cursor];
    cursor += 1;
  }

  flushBuffer();

  return nodes;
}

function readInlineToken(
  text: string,
  index: number,
  settings: ResolvedChatMarkdownSettings,
  key: string
): InlineMatch | null {
  const inlineCode = readInlineCode(text, index, settings, key);
  if (inlineCode) {
    return inlineCode;
  }

  const link = readMaskedLink(text, index, settings, key);
  if (link) {
    return link;
  }

  if (text.startsWith("__", index)) {
    return readDelimitedToken(text, index, "__", settings.underline, settings, key, (children) => (
      <u key={key} className="underline-offset-2">
        {children}
      </u>
    ));
  }

  if (text.startsWith("~~", index)) {
    return readDelimitedToken(text, index, "~~", settings.strikethrough, settings, key, (children) => (
      <s key={key}>{children}</s>
    ));
  }

  if (text.startsWith("***", index)) {
    return readDelimitedToken(
      text,
      index,
      "***",
      settings.boldItalic && settings.bold && settings.italic,
      settings,
      key,
      (children) => (
        <strong key={key}>
          <em>{children}</em>
        </strong>
      )
    );
  }

  if (text.startsWith("**", index)) {
    return readDelimitedToken(text, index, "**", settings.bold, settings, key, (children) => (
      <strong key={key}>{children}</strong>
    ));
  }

  if (text.startsWith("*", index)) {
    return readDelimitedToken(text, index, "*", settings.italic, settings, key, (children) => (
      <em key={key}>{children}</em>
    ));
  }

  if (text.startsWith("_", index)) {
    return readDelimitedToken(text, index, "_", settings.italic, settings, key, (children) => (
      <em key={key}>{children}</em>
    ));
  }

  return null;
}

function readInlineCode(
  text: string,
  index: number,
  settings: ResolvedChatMarkdownSettings,
  key: string
): InlineMatch | null {
  if (text[index] !== "`") {
    return null;
  }

  const endIndex = text.indexOf("`", index + 1);
  if (endIndex <= index + 1) {
    return null;
  }

  const raw = text.slice(index, endIndex + 1);
  const code = text.slice(index + 1, endIndex);

  return {
    node: settings.inlineCode ? (
      <code key={key} className="rounded bg-black/20 px-1 py-0.5 font-mono text-[0.92em]">
        {code}
      </code>
    ) : (
      raw
    ),
    nextIndex: endIndex + 1,
  };
}

function readMaskedLink(
  text: string,
  index: number,
  settings: ResolvedChatMarkdownSettings,
  key: string
): InlineMatch | null {
  if (text[index] !== "[") {
    return null;
  }

  const labelEndIndex = text.indexOf("](", index + 1);
  if (labelEndIndex === -1) {
    return null;
  }

  const urlEndIndex = text.indexOf(")", labelEndIndex + 2);
  if (urlEndIndex === -1) {
    return null;
  }

  const label = text.slice(index + 1, labelEndIndex);
  const href = text.slice(labelEndIndex + 2, urlEndIndex).trim();
  if (!label || !href) {
    return null;
  }

  const raw = text.slice(index, urlEndIndex + 1);
  if (!settings.links || !isSafeHref(href)) {
    return {
      node: raw,
      nextIndex: urlEndIndex + 1,
    };
  }

  return {
    node: (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium underline underline-offset-2 hover:opacity-80"
      >
        {parseInline(label, { ...settings, links: false }, `${key}-label`)}
      </a>
    ),
    nextIndex: urlEndIndex + 1,
  };
}

function readDelimitedToken(
  text: string,
  index: number,
  delimiter: string,
  enabled: boolean,
  settings: ResolvedChatMarkdownSettings,
  key: string,
  render: (children: ReactNode[]) => ReactNode
): InlineMatch | null {
  const contentStartIndex = index + delimiter.length;
  const contentEndIndex = text.indexOf(delimiter, contentStartIndex);
  if (contentEndIndex <= contentStartIndex) {
    return null;
  }

  const raw = text.slice(index, contentEndIndex + delimiter.length);
  if (!enabled) {
    return {
      node: raw,
      nextIndex: contentEndIndex + delimiter.length,
    };
  }

  return {
    node: render(parseInline(text.slice(contentStartIndex, contentEndIndex), settings, `${key}-content`)),
    nextIndex: contentEndIndex + delimiter.length,
  };
}

function isSafeHref(href: string) {
  if (/[\u0000-\u001F\u007F\s]/.test(href)) {
    return false;
  }

  if (href.startsWith("/") || href.startsWith("#")) {
    return true;
  }

  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}
