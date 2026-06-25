# Passkeys Directory

An open, community-maintained directory of websites that support **passkeys** —
for passwordless sign-in and/or as a second factor.

Unlike other directories, this one has **no global-rank cap**. Any site in roughly
the **top 1,000,000** is in scope, including sites that are popular only within a
single country. Those locally-dominant sites — a national bank, a regional telco,
a country's tax portal — are exactly the ones global-rank-capped directories drop,
and exactly where "does this site support passkeys?" matters most.

This repository is **purely a data source.** It powers [whynopasskeys.com](https://whynopasskeys.com)
and is free for anyone else to consume.

## Consuming the data

Fetch the compiled feed:

```
https://raw.githubusercontent.com/ScottHelme/passkeys-directory/main/data/passkeys.json
```

It's a JSON object keyed by registrable domain:

```json
{
  "paypal.com": { "passwordless": true, "mfa": false, "documentation": "https://…" },
  "google.com": { "passwordless": true, "mfa": false }
}
```

- `passwordless` — passkeys can be used to sign in without a password.
- `mfa` — passkeys can be used as a second factor.
- `documentation` — optional link to the site's passkey setup docs.

This shape is deliberately compatible with 2factorauth's `supported.json`, so
existing consumers can switch the URL and change nothing else.

## Suggesting a site

**Open an issue, not a pull request.** Use the
[Add a site](../../issues/new?template=add-site.yml) or
[Correct a site](../../issues/new?template=correct-site.yml) form. A maintainer
verifies each suggestion (checking the live sign-in flow) before the entry lands.
Keeping verification off the public PR path is what lets this directory cover the
long tail without drowning in unverifiable edits.

A link to the site's own passkey documentation makes verification much faster —
please include one if you can.

## Repository layout

```
entries/<first-char>/<domain>.json   one file per site (the source of truth)
data/passkeys.json                   compiled, consumable feed (generated)
schema.json                          JSON Schema for an entry
build/import-seed.js                 one-off: import the openly-licensed directories
build/compile.js                     entries/ -> data/passkeys.json
```

Rebuild the feed after editing entries:

```
npm run build
```

## Sources & licensing

Seeded from [2factorauth](https://github.com/2factorauth/passkeys) (CC-BY-4.0) and
[Dashlane](https://github.com/Dashlane/passkeys-resources) (MIT). Bitwarden's and
1Password's directories are **not** ingested — neither publishes a reusable licence.
See [ATTRIBUTION.md](ATTRIBUTION.md).

This dataset is released under **CC-BY-4.0**, so corrections can be contributed back
upstream and anyone can reuse it with attribution.
