const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

/** Trailing punctuation from the sentence around a link, keeping a ")" that closes one inside it. */
function trimLink(url: string): string {
  let out = url.replace(/[.,;:!?'"\]}]+$/, "");
  while (out.endsWith(")") && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1).replace(/[.,;:!?'"\]}]+$/, "");
  }
  return out;
}

/** The distinct http(s) links in a piece of text, in order. */
export function findLinks(text: string): string[] {
  return [...new Set((text.match(URL_PATTERN) ?? []).map(trimLink))];
}

/** A short label for a link while it's being read: host and path, without the scheme. */
export function linkLabel(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const label = `${hostname.replace(/^www\./, "")}${pathname === "/" ? "" : pathname}`;
    return label.length > 48 ? `${label.slice(0, 47)}…` : label;
  } catch {
    return url.slice(0, 48);
  }
}
