import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, "$1:");
const port = Number(process.env.COMOOTD_TEST_PORT || 4173);
const mime = { ".html":"text/html; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml", ".webp":"image/webp" };

createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (pathname === "/config.js") {
    response.writeHead(200, { "content-type":"application/javascript; charset=utf-8", "cache-control":"no-store" });
    response.end("window.SISIP_CONFIG={supabaseUrl:'',supabasePublishableKey:'',siteUrl:'http://127.0.0.1:4173',adminEmail:'comootd@gmail.com'};");
    return;
  }
  const relative = pathname === "/" || !extname(pathname) ? "index.html" : pathname.replace(/^\/+/, "");
  const target = normalize(join(root, relative));
  if (!target.startsWith(normalize(root))) { response.writeHead(403); response.end(); return; }
  try {
    const body = await readFile(target);
    response.writeHead(200, { "content-type":mime[extname(target)] || "application/octet-stream", "cache-control":"no-store" });
    response.end(body);
  } catch { response.writeHead(404); response.end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`COMOOTD safe preview: http://127.0.0.1:${port}`));
