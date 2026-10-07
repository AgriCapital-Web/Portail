// @ts-nocheck
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORBIDDEN = [
  /contribution/i,
  /redevance/i,
  /dépôt\s+initial/i,
  /depot[_\s]+initial/i,
  /souscripteur/i,
  /subscriber[-_]?lookup/i,
  /paiement\s+mensuel\s+progressif/i,
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

describe("Aucune ancienne terminologie de paiement dans AC_Clients", () => {
  const files = walk(ROOT).filter((f) => !/\.test\.tsx?$/.test(f));
  it.each(files)("%s ne contient pas de terminologie obsolète", (file) => {
    const content = readFileSync(file, "utf8");
    for (const re of FORBIDDEN) expect(content).not.toMatch(re);
  });
});
