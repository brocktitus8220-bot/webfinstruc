import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_DOMAIN, PRODUCT_NAME } from "@repo/core/config";

const ROOT = join(__dirname, "../../../..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", ".git", "migrations"]);
const CONFIG = join("packages", "core", "src", "config.ts");

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(tsx?|mjs|json|md|css)$/.test(name)) yield path;
  }
}

describe("product name", () => {
  it("is only defined in packages/core/src/config.ts", () => {
    const offenders: string[] = [];
    const needles = [PRODUCT_NAME.toLowerCase(), PRODUCT_DOMAIN.toLowerCase()];
    for (const file of files(ROOT)) {
      const rel = relative(ROOT, file);
      if (rel === CONFIG || rel.endsWith("product-name.test.ts")) continue;
      const text = readFileSync(file, "utf8").toLowerCase();
      if (needles.some((n) => text.includes(n))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
