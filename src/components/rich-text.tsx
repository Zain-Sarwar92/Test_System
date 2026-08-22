import { cn } from "@/lib/utils";

const ALLOWED_TAGS = new Set([
  "img",
  "br",
  "sub",
  "sup",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "u",
]);

/**
 * Decode common HTML entities (including double-encoded like &amp;quot;).
 */
export function decodeHtmlEntities(input: string): string {
  let s = input;
  for (let i = 0; i < 3; i++) {
    const prev = s;
    s = s
      .replace(/&nbsp;/gi, "\u00a0")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#0*39;/g, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#(\d+);/g, (_, n) => {
        const code = Number(n);
        return Number.isFinite(code) ? String.fromCharCode(code) : _;
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
        const code = parseInt(h, 16);
        return Number.isFinite(code) ? String.fromCharCode(code) : _;
      })
      .replace(/&amp;/gi, "&");
    if (s === prev) break;
  }
  return s;
}

/** Convert block tags that would nest badly inside <p> into line breaks. */
function normalizeBlockTags(input: string): string {
  return input
    .replace(/<\/p>\s*<p\b[^>]*>/gi, "<br /><br />")
    .replace(/<p\b[^>]*>/gi, "")
    .replace(/<\/p>/gi, "<br />")
    .replace(/<\/div>\s*<div\b[^>]*>/gi, "<br /><br />")
    .replace(/<div\b[^>]*>/gi, "")
    .replace(/<\/div>/gi, "<br />")
    .replace(/(?:<br\s*\/?\s*>\s*)+$/i, "");
}

/** True when the string looks like HTML we should render (e.g. equation <img>). */
export function looksLikeRichHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<\s*(img|br|sub|sup|span|strong|em|b|i|u)\b/i.test(value);
}

/**
 * Very small sanitizer: keeps only allowlisted tags + safe attributes.
 * Strips event handlers and non-http(s)/relative src/href values.
 */
export function sanitizeRichHtml(input: string): string {
  return input
    .replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag: string, attrs = "") => {
      const name = tag.toLowerCase();
      const closing = full.startsWith("</");
      if (!ALLOWED_TAGS.has(name)) return "";
      if (closing) return `</${name}>`;
      if (name === "br") return "<br />";

      if (name === "img") {
        const srcMatch = attrs.match(/\ssrc\s*=\s*(["'])([^"']+)\1/i);
        const src = srcMatch?.[2]?.trim() ?? "";
        if (!src) return "";
        const ok =
          (src.startsWith("/") && !src.startsWith("//")) ||
          src.startsWith("https://");
        if (!ok) return "";
        const altMatch = attrs.match(/\salt\s*=\s*(["'])([^"']*)\1/i);
        const alt = altMatch?.[2] ?? "";
        return `<img src="${src.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}" class="eq-img" />`;
      }

      return `<${name}>`;
    })
    .replace(/on\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/javascript:/gi, "");
}

/** Prepare bank/HTML text for safe display: entities → characters, blocks → breaks. */
export function prepareRichTextValue(value: string): string {
  return normalizeBlockTags(decodeHtmlEntities(value));
}

export function RichText({
  value,
  className,
  dir,
  as: Tag = "span",
}: {
  value: string;
  className?: string;
  dir?: "rtl" | "ltr" | "auto";
  as?: "span" | "p" | "div";
}) {
  const prepared = prepareRichTextValue(value);
  const useUrduFont = dir === "rtl" || /[\u0600-\u06FF]/.test(prepared);

  if (!looksLikeRichHtml(prepared)) {
    return (
      <Tag className={cn(useUrduFont && "font-urdu", className)} dir={dir}>
        {prepared}
      </Tag>
    );
  }

  const html = sanitizeRichHtml(prepared);
  return (
    <Tag
      className={cn("rich-text", useUrduFont && "font-urdu", className)}
      dir={dir}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
