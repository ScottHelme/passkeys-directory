// Validate every entry file for structural + logical consistency. Dependency-free
// so it can run in CI later. Exits non-zero if any ERROR is found; WARNs don't fail.
//
//   node build/validate.js

import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = join(ROOT, "entries");

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const KNOWN_SOURCES = new Set(["2factorauth", "dashlane", "community", "probe"]);
const REQUIRED = ["domain", "passkey_signin", "passkey_mfa", "sources"];

const errors = [];
const warns = [];
const err = (d, m) => errors.push(`${d}: ${m}`);
const warn = (d, m) => warns.push(`${d}: ${m}`);

async function load() {
  const out = [];
  for (const b of await readdir(ENTRIES)) {
    let files = [];
    try {
      files = await readdir(join(ENTRIES, b));
    } catch {
      continue;
    }
    for (const f of files.filter((f) => f.endsWith(".json"))) {
      const path = join("entries", b, f);
      let e;
      try {
        e = JSON.parse(await readFile(join(ENTRIES, b, f), "utf8"));
      } catch (ex) {
        err(path, `invalid JSON (${ex.message})`);
        continue;
      }
      out.push({ e, path, file: f, bucket: b });
    }
  }
  return out;
}

const all = await load();
const seenDomain = new Map(); // domain -> path
const claimedDomain = new Map(); // any domain (primary or alias) -> owning entry

for (const { e, path, file, bucket } of all) {
  for (const k of REQUIRED) if (e[k] === undefined) err(path, `missing required field "${k}"`);
  if (typeof e.domain !== "string") continue;

  if (e.domain !== e.domain.toLowerCase()) err(path, `domain not lowercase: ${e.domain}`);
  if (!DOMAIN_RE.test(e.domain)) err(path, `domain not a bare registrable domain: ${e.domain}`);
  if (file !== `${e.domain}.json`) err(path, `filename should be ${e.domain}.json`);
  const expectBucket = /^[a-z]/.test(e.domain) ? e.domain[0] : "0-9";
  if (bucket !== expectBucket) err(path, `should live in entries/${expectBucket}/`);

  if (typeof e.passkey_signin !== "boolean") err(path, `passkey_signin must be boolean`);
  if (typeof e.passkey_mfa !== "boolean") err(path, `passkey_mfa must be boolean`);
  if (e.passkey_signin === false && e.passkey_mfa === false)
    err(path, `supports neither sign-in nor MFA — should not be listed`);

  if (!Array.isArray(e.sources) || e.sources.length === 0) err(path, `sources must be a non-empty array`);
  else for (const s of e.sources) if (!KNOWN_SOURCES.has(s)) warn(path, `unknown source "${s}"`);

  if (seenDomain.has(e.domain)) err(path, `duplicate domain, also in ${seenDomain.get(e.domain)}`);
  seenDomain.set(e.domain, path);

  if (claimedDomain.has(e.domain))
    err(path, `domain also claimed as an alias by ${claimedDomain.get(e.domain)}`);
  claimedDomain.set(e.domain, path);
  for (const a of e.additional_domains || []) {
    if (typeof a !== "string" || !DOMAIN_RE.test(a)) err(path, `bad additional_domain: ${a}`);
    if (a === e.domain) err(path, `additional_domain duplicates primary domain`);
    if (claimedDomain.has(a) && claimedDomain.get(a) !== path)
      err(path, `alias ${a} also claimed by ${claimedDomain.get(a)}`);
    claimedDomain.set(a, path);
  }

  if (e.documentation != null && !/^https?:\/\//.test(e.documentation))
    warn(path, `documentation is not an http(s) URL`);
}

console.log(`Validated ${all.length} entries.`);
if (warns.length) {
  console.log(`\n${warns.length} warning(s):`);
  for (const w of warns.slice(0, 50)) console.log(`  WARN ${w}`);
  if (warns.length > 50) console.log(`  …and ${warns.length - 50} more`);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors.slice(0, 50)) console.log(`  ERR  ${e}`);
  if (errors.length > 50) console.log(`  …and ${errors.length - 50} more`);
  process.exit(1);
}
console.log("\nOK — no errors.");
