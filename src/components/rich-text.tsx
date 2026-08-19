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
        // Block javascript: etc already by ok check
        const altMatch = attrs.match(/\salt\s*=\s*(["'])([^"']*)\1/i);
        const alt = altMatch?.[2] ?? "";
        return `<img src="${src.replace(/"/g, "&quot;")}" alt="${alt.replace(/"/g, "&quot;")}" class="eq-img" />`;
      }

      return `<${name}>`;
    })
    .replace(/on\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/javascript:/gi, "");
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
  if (!looksLikeRichHtml(value)) {
    return (
      <Tag className={className} dir={dir}>
        {value}
      </Tag>
    );
  }

  const html = sanitizeRichHtml(value);
  return (
    <Tag
      className={cn("rich-text", className)}
      dir={dir}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
