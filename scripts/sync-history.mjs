// public/data/history is gitignored, so a pull that brings a new manifest and snapshot leaves
// last release's buckets behind and stage-public refuses the mixed build. This restores the
// archive the manifest names, the same way deploy.yml does. Needs an authenticated `gh`.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';

const mf = JSON.parse(await readFile('public/data/manifest.json', 'utf8'));
const archive = mf.assets?.archives?.history;
if (!mf.release_id || !archive) {
  console.log('history sync: the manifest names no history archive, nothing to do');
  process.exit(0);
}

const local = await readFile('public/data/history/index.json', 'utf8').then(JSON.parse).catch(() => null);
if (local?.release_id === mf.release_id) {
  console.log('history sync: already at this release');
  process.exit(0);
}

// tar gets relative paths only: GNU tar reads "C:\..." as a remote host.
const tmp = 'build/history-sync';
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });

const tag = `data-${mf.redfin.period_end.slice(0, 7)}`;
console.log(`history sync: downloading ${archive.file} from ${tag}`);
execFileSync('gh', ['release', 'download', tag, '--pattern', archive.file, '--dir', tmp], { stdio: 'inherit' });

const sha = createHash('sha256').update(await readFile(`${tmp}/${archive.file}`)).digest('hex');
if (sha !== archive.sha256) throw Error(`History archive hash ${sha} does not match the manifest's ${archive.sha256}`);

// Extracted in place: renaming the freshly written 6,000-file directory into position
// failed with EPERM on Windows.
await rm('public/data/history', { recursive: true, force: true });
await mkdir('public/data/history', { recursive: true });
execFileSync('tar', ['-xzf', `${tmp}/${archive.file}`, '-C', 'public/data/history'], { stdio: 'inherit' });
await rm(tmp, { recursive: true, force: true });
console.log(`history sync: public/data/history is now release ${mf.release_id.slice(0, 12)}`);
