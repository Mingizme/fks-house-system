const DANGEROUS_BLOCK_RE = /<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi;
const DANGEROUS_SINGLE_RE = /<(script|style|iframe|object|embed|link|meta|base)[^>]*\/?>/gi;
const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/gi;
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeChatContent(value: string) {
  return value
    .replace(DANGEROUS_BLOCK_RE, "")
    .replace(DANGEROUS_SINGLE_RE, "")
    .replace(HTML_TAG_RE, "")
    .replace(CONTROL_CHAR_RE, "")
    .trim();
}
