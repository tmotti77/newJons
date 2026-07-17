/**
 * Bundles supabase/functions-src/api.ts (which routes to all handlers) into
 * supabase/functions/api/index.ts as a single minified Deno-ready ESM file.
 * zod + supabase-js stay external (resolved via deno.json import map).
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";

async function main() {
  mkdirSync("supabase/functions/api", { recursive: true });
  await build({
    entryPoints: ["supabase/functions-src/api.ts"],
    outfile: "supabase/functions/api/index.ts",
    bundle: true,
    minify: true,
    format: "esm",
    platform: "neutral",
    target: "esnext",
    external: ["npm:*", "jsr:*", "zod"],
    logLevel: "warning"
  });
  writeFileSync(
    "supabase/functions/api/deno.json",
    JSON.stringify({ imports: { zod: "npm:zod@3.23.8" } }, null, 2) + "\n"
  );
  console.log("bundled api");
}

void main();
