// client/src/game/ never imports React.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../client/src/game", import.meta.url).pathname;
const offenders = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) {
      const src = readFileSync(p, "utf8");
      if (/from\s+["']react["']|from\s+["']react-dom/.test(src)) offenders.push(p);
    }
  }
}
walk(root);
if (offenders.length) {
  console.error("Repo Law 1 violated — React import inside game engine:\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("Repo Law 1 OK — game engine is React-free");
