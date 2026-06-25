// One-off seed importer. Pulls the two openly-licensed passkey directories
// (2factorauth, CC-BY-4.0; Dashlane, MIT) and writes per-domain entry files.
// Re-runnable: existing entries are merged, not clobbered, so hand-curated
// fields and community additions survive a re-seed.
//
//   node build/import-seed.js
//
// NOT pulled: Bitwarden and 1Password — neither publishes a reusable licence,
// so their data cannot be redistributed here. See README "Sources & licensing".

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = join(ROOT, "entries");

const SOURCES = {
  twofa: "https://passkeys-api.2fa.directory/v1/supported.json",
  dashlane: "https://raw.githubusercontent.com/Dashlane/passkeys-resources/main/resources/compatible-domains.json",
};

const today = () => new Date().toISOString().slice(0, 10);
const bucket = (domain) => (/^[a-z]/.test(domain) ? domain[0] : "0-9");
const entryPath = (domain) => join(ENTRIES, bucket(domain), `${domain}.json`);

async function loadExisting() {
  const map = new Map();
  let buckets = [];
  try {
    buckets = await readdir(ENTRIES);
  } catch {
    return map;
  }
  for (const b of buckets) {
    let files = [];
    try {
      files = await readdir(join(ENTRIES, b));
    } catch {
      continue;
    }
    for (const f of files.filter((f) => f.endsWith(".json"))) {
      const e = JSON.parse(await readFile(join(ENTRIES, b, f), "utf8"));
      map.set(e.domain, e);
    }
  }
  return map;
}

function upsert(map, domain, patch, source) {
  domain = domain.toLowerCase().replace(/^www\./, "");
  const e = map.get(domain) || {
    domain,
    name: null,
    passkey_signin: false,
    passkey_mfa: false,
    additional_domains: [],
    category: null,
    region: "global",
    documentation: null,
    sources: [],
    added: today(),
  };
  if (patch.name && !e.name) e.name = patch.name;
  // Support is monotonic: once a source asserts it, keep it.
  e.passkey_signin = e.passkey_signin || Boolean(patch.passkey_signin);
  e.passkey_mfa = e.passkey_mfa || Boolean(patch.passkey_mfa);
  if (patch.category && !e.category) e.category = patch.category;
  if (patch.documentation && !e.documentation) e.documentation = patch.documentation;
  for (const d of patch.additional_domains || []) {
    const dd = d.toLowerCase();
    if (dd !== domain && !e.additional_domains.includes(dd)) e.additional_domains.push(dd);
  }
  if (!e.sources.includes(source)) e.sources.push(source);
  map.set(domain, e);
}

async function importTwoFa(map) {
  const data = await (await fetch(SOURCES.twofa)).json();
  let n = 0;
  for (const [domain, info] of Object.entries(data)) {
    upsert(
      map,
      domain,
      {
        name: info.name,
        // 2factorauth's "passkeys" feed: a `passwordless` field means passkey
        // sign-in; `mfa` means passkey usable as a second factor.
        passkey_signin: Boolean(info.passwordless),
        passkey_mfa: Boolean(info.mfa),
        category: info.categories || info.category,
        documentation: info.documentation,
        additional_domains: info["additional-domains"],
      },
      "2factorauth",
    );
    n++;
  }
  return n;
}

async function importDashlane(map) {
  const list = await (await fetch(SOURCES.dashlane)).json();
  for (const domain of list) {
    // Dashlane's list is "compatible domains" = passkey sign-in works.
    upsert(map, domain, { passkey_signin: true }, "dashlane");
  }
  return list.length;
}

async function main() {
  const map = await loadExisting();
  const before = map.size;
  const a = await importTwoFa(map);
  const b = await importDashlane(map);

  // Write every entry back out, sorted by domain within its bucket.
  const byBucket = new Map();
  for (const e of map.values()) {
    e.additional_domains.sort();
    e.sources.sort();
    (byBucket.get(bucket(e.domain)) || byBucket.set(bucket(e.domain), []).get(bucket(e.domain))).push(e);
  }
  for (const [b, list] of byBucket) {
    await mkdir(join(ENTRIES, b), { recursive: true });
    for (const e of list) {
      await writeFile(entryPath(e.domain), JSON.stringify(e, null, 2) + "\n");
    }
  }

  console.log(`2factorauth: ${a} sites`);
  console.log(`Dashlane:    ${b} domains`);
  console.log(`entries:     ${before} -> ${map.size} (${map.size - before} new)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
