import en from "../../../shared/i18n/en.json";
import de from "../../../shared/i18n/de.json";
import ru from "../../../shared/i18n/ru.json";

export type Locale = "en" | "de" | "ru";
const packs: Record<Locale, Record<string, string>> = { en, de, ru };

let current: Locale = "en";

export function setLocale(l: Locale): void {
  current = l;
}

export function t(key: string): string {
  return packs[current][key] ?? packs.en[key] ?? key;
}
