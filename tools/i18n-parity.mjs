// all three locales carry identical key sets or the build fails.
import { readFileSync } from "node:fs";

const locales = ["en", "de", "ru"];
const keysets = Object.fromEntries(
  locales.map((l) => [l, new Set(Object.keys(JSON.parse(readFileSync(`shared/i18n/${l}.json`, "utf8"))))]),
);
const union = new Set(locales.flatMap((l) => [...keysets[l]]));
let failed = false;
for (const l of locales) {
  const missing = [...union].filter((k) => !keysets[l].has(k));
  if (missing.length) {
    console.error(`i18n parity FAIL — ${l}.json missing: ${missing.join(", ")}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`i18n parity OK — ${union.size} keys × ${locales.length} locales`);
