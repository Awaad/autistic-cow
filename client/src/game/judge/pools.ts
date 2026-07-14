/** Locale -> comment pool. Pools are CONTENT: culture-rewrites with
 * independent line counts
 * DE/RU are rewrites in persona — native validation required
 * before ship. */

import { COMMENTS_EN, type CommentLine } from "./comments-en";
import { COMMENTS_DE } from "./comments-de";
import { COMMENTS_RU } from "./comments-ru";

export function poolFor(locale: string): CommentLine[] {
  switch (locale) {
    case "de": return COMMENTS_DE;
    case "ru": return COMMENTS_RU;
    default: return COMMENTS_EN;
  }
}