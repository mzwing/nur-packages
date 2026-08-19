// Fill missing lockfile URLs and hashes from immutable registry metadata without changing versions.
import { readFileSync, writeFileSync } from "node:fs";

const LOCKFILE = process.argv[2] ?? "package-lock.json";

const lock = JSON.parse(readFileSync(LOCKFILE, "utf8"));
const pk = lock.packages ?? {};

const missing = [];
for (const [key, value] of Object.entries(pk)) {
  if (!key.startsWith("node_modules/") || value.resolved || value.link) {
    continue;
  }
  if (!value.version) {
    continue;
  }
  // Prefer alias names, otherwise use the last lockfile path segment.
  missing.push({
    key,
    name: value.name ?? key.split("node_modules/").pop(),
    version: value.version,
  });
}

if (missing.length === 0) {
  process.stderr.write("repair-lockfile: nothing to do\n");
  process.exit(0);
}

process.stderr.write(
  `repair-lockfile: filling ${missing.length} entries missing resolved/integrity\n`,
);

// Encode scoped package names for registry URLs.
function packumentUrl(name, version) {
  const enc = name.replace("/", "%2F"); // Keep the leading `@`.
  return `https://registry.npmjs.org/${enc}/${version}`;
}

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        return await res.json();
      }
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  throw lastError;
}

const failures = [];
let cursor = 0;
const workers = Array.from({ length: 24 }, async () => {
  while (cursor < missing.length) {
    const { key, name, version } = missing[cursor++];
    try {
      const data = await fetchWithRetry(packumentUrl(name, version));
      const dist = data?.dist;
      if (!dist?.tarball || !dist?.integrity) {
        throw new Error(`no dist metadata for ${name}@${version}`);
      }
      pk[key].resolved = dist.tarball.replace(/^http:\/\//, "https://");
      pk[key].integrity = dist.integrity;
    } catch (err) {
      failures.push(`${name}@${version} (${key}): ${err}`);
    }
  }
});
await Promise.all(workers);

if (failures.length > 0) {
  for (const f of failures) {
    process.stderr.write(`repair-lockfile: FAILED ${f}\n`);
  }
  process.stderr.write(
    `repair-lockfile: ${failures.length} entries could not be repaired\n`,
  );
  process.exit(1);
}

writeFileSync(LOCKFILE, JSON.stringify(lock, null, 2) + "\n");
process.stderr.write(
  `repair-lockfile: repaired ${missing.length} entries\n`,
);
