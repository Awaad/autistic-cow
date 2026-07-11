import { COMMENTS_EN, type CommentLine } from "./comments-en";
// Later: comments-de.ts, comments-ru.ts — REWRITES, line counts may differ
export function poolFor(locale: string): CommentLine[] {
  switch (locale) {
    // case "de": return COMMENTS_DE;   // Later
    // case "ru": return COMMENTS_RU;   // Later
    default: return COMMENTS_EN;        // known gap until the rewrites land
  }
}