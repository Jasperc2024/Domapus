// Static server matching GitHub Pages: base path, gzip on text, Range support.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { createGzip } from "node:zlib";

const root = process.argv[2] ?? "dist";
// Base is passed WITHOUT slashes ("Domapus"): Git Bash rewrites any argument
// starting with "/" into a Windows path. Slashes are added here instead.
const BASE = "/" + (process.argv[3] ?? "Domapus").replace(/^[\/]+|[\/]+$/g, "").replace(/^.*:[\/]/, "") + "/";
const PORT = Number(process.argv[4] ?? 4319);

const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png",
  ".ico":"image/x-icon", ".pmtiles":"application/octet-stream",
  ".u8":"application/octet-stream",
  ".webmanifest":"application/manifest+json", ".xml":"application/xml",
  ".txt":"text/plain", ".csv":"text/csv", ".gz":"application/gzip" };
// VERIFIED AGAINST THE LIVE SITE, not assumed. GitHub Pages returns the paint
// table with `Content-Encoding: gzip` at 24,531 B against 100,000 B raw, which is
// the "~24 KB on the wire" the whole first-paint design rests on. Omitting ".u8"
// here made this server report 100,000 B and inflated `gatingBytes` — the one
// headline number this harness exists to defend — nearly fourfold, as a property
// of the server rather than of the build.
//
// ".pmtiles" stays out on purpose: it is fetched by Range request, and range plus
// content coding do not mix.
const GZIP = new Set([".html",".js",".css",".json",".svg",".xml",".txt",".csv",".webmanifest",".u8"]);

createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!p.startsWith(BASE)) return void res.writeHead(404).end();
  const rel = normalize(p.slice(BASE.length)) || "index.html";
  if (rel.includes("..")) return void res.writeHead(403).end();
  let f = join(root, rel);
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, "index.html");
  if (!existsSync(f)) return void res.writeHead(404).end();
  const ext = extname(f), info = statSync(f);
  const h = { "content-type": MIME[ext] || "application/octet-stream", "accept-ranges": "bytes" };
  if (req.headers.range) {
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    const s = m[1] ? +m[1] : 0, e = m[2] ? +m[2] : info.size - 1;
    res.writeHead(206, { ...h, "content-range": `bytes ${s}-${e}/${info.size}`, "content-length": e - s + 1 });
    return void createReadStream(f, { start: s, end: e }).pipe(res);
  }
  if (GZIP.has(ext) && /gzip/.test(req.headers["accept-encoding"] || "")) {
    res.writeHead(200, { ...h, "content-encoding": "gzip" });
    return void createReadStream(f).pipe(createGzip()).pipe(res);
  }
  res.writeHead(200, { ...h, "content-length": info.size });
  createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`serving ${root} at http://localhost:${PORT}${BASE}`));
