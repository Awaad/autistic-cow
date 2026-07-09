// Sanity gate for tuning.json: structural checks that catch fat-fingers.
import { readFileSync } from "node:fs";
const t = JSON.parse(readFileSync("shared/tuning/tuning.json", "utf8"));
const errs = [];
const bands = t.rage.bands;
if (!(bands.serene.max < bands.irritated.max && bands.irritated.max < bands.furious.max && bands.furious.max < bands.berserk.max))
  errs.push("rage bands must be strictly ascending");
if (t.rage.sinks.beer_generic >= 0) errs.push("beer must reduce rage (negative)");
if (t.maxrage.decision_timer_s < 5) errs.push("decision timer < 5s is unplayable");
for (const [k, v] of Object.entries(t.judge.karma_weights))
  if (Math.abs(v) > 0.5) errs.push(`karma weight ${k}=${v} is implausibly large`);
if (errs.length) { console.error("tuning.json FAIL:\n- " + errs.join("\n- ")); process.exit(1); }
console.log("tuning.json OK (version " + t.version + ")");
