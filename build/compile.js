// Compile the per-domain entry files into a single consumable feed at
// data/passkeys.json, keyed by registrable domain. The shape is intentionally
// a superset-compatible match for 2factorauth's supported.json so existing
// consumers (e.g. whynopasskeys.com) can switch their fetch URL and nothing else.
//
//   data/passkeys.json
//   { "example.com": { "passwordless": true, "mfa": true, "documentation": "https://…" }, … }
//
// Every entry's `additional_domains` are expanded into their own keys pointing
// at the same metadata, so a ranked alias resolves without an eTLD+1 collapse.

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = join(ROOT, "entries");
const OUT = join(ROOT, "data", "passkeys.json");

async function allEntries() {
  const out = [];
  for (const b of await readdir(ENTRIES)) {
    let files = [];
    try {
      files = await readdir(join(ENTRIES, b));
    } catch {
      continue;
    }
    for (const f of files.filter((f) => f.endsWith(".json"))) {
      out.push(JSON.parse(await readFile(join(ENTRIES, b, f), "utf8")));
    }
  }
  return out;
}

async function main() {
  const entries = await allEntries();
  const feed = {};
  let aliases = 0;
  for (const e of entries) {
    const meta = {
      passwordless: Boolean(e.passkey_signin),
      mfa: Boolean(e.passkey_mfa),
      ...(e.documentation ? { documentation: e.documentation } : {}),
    };
    feed[e.domain] = meta;
    for (const alias of e.additional_domains || []) {
      if (!feed[alias]) {
        feed[alias] = meta;
        aliases++;
      }
    }
  }
  const sorted = Object.fromEntries(Object.keys(feed).sort().map((k) => [k, feed[k]]));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`compiled ${entries.length} entries (+${aliases} aliases) -> data/passkeys.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
