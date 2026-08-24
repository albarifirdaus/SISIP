const CONTENT_SPECS = {
  look: {
    table: "looks",
    select: "slug,title,excerpt,cover_image_path,style_tags,gender_target",
    title: (row) => `${row.title || "Look"} — COMOOTD Look`,
    description: (row) => {
      const styles = Array.isArray(row.style_tags) ? row.style_tags.filter(Boolean).slice(0, 3) : [];
      return styles.length ? `${styles.join(" · ")} — temukan setiap item dalam look ini di COMOOTD.` : "Temukan setiap item dalam look kurasi COMOOTD ini.";
    },
    type: "website"
  },
  product: {
    table: "products",
    select: "id,slug,name,price_idr,cover_image_path,style_tags,gender_target",
    title: (row) => `${row.name || "Produk"} — COMOOTD`,
    description: (row) => {
      const price = Number(row.price_idr || 0);
      const styles = Array.isArray(row.style_tags) ? row.style_tags.filter(Boolean).slice(0, 3) : [];
      const formattedPrice = Number.isFinite(price) && price > 0 ? `Rp${price.toLocaleString("id-ID")}` : "Pilihan kurasi COMOOTD";
      return `${formattedPrice}${styles.length ? ` · ${styles.join(" · ")}` : ""} — pilihan kurasi COMOOTD yang mudah dipadankan.`;
    },
    type: "product"
  },
  article: {
    table: "articles",
    select: "slug,title,excerpt,cover_image_path,cover_alt_text,category,style_tags",
    title: (row) => `${row.title || "Journal"} — COMOOTD Journal`,
    description: (row) => row.excerpt || "Catatan style dari COMOOTD.",
    type: "article"
  }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clippedText(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : text;
}

function routeFromRequest(request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const type = parts[0] === "looks" ? "look" : parts[0] === "products" ? "product" : parts[0] === "journal" ? "article" : "";
  if (!type) return null;
  try {
    const slug = decodeURIComponent(parts[1]).trim().toLowerCase();
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? { type, slug } : null;
  } catch {
    return null;
  }
}

function siteOrigin(env) {
  try {
    return new URL(String(env.SITE_ORIGIN || "https://sisip-fashion.pages.dev")).origin;
  } catch {
    return "https://sisip-fashion.pages.dev";
  }
}

function storageImageUrl(env, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const external = new URL(raw);
    return external.protocol === "https:" || external.protocol === "http:" ? external.href : "";
  } catch {
    const parts = raw.replace(/^\/+/, "").split("/");
    if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) return "";
    return `${String(env.SUPABASE_URL || "").replace(/\/+$/, "")}/storage/v1/object/public/sisip-media/${parts.map(encodeURIComponent).join("/")}`;
  }
}

function replaceAttribute(html, id, attribute, value) {
  const pattern = new RegExp(`(<(?:meta|link)\\b[^>]*\\bid=["']${id}["'][^>]*\\b${attribute}=["'])[^"']*(["'][^>]*>)`, "i");
  return html.replace(pattern, `$1${escapeHtml(value)}$2`);
}

function injectMetadata(html, metadata) {
  let page = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title id="pageTitle">${escapeHtml(metadata.title)}</title>`);
  page = replaceAttribute(page, "pageDescription", "content", metadata.description);
  page = replaceAttribute(page, "canonicalUrl", "href", metadata.canonical);
  page = replaceAttribute(page, "openGraphType", "content", metadata.type);
  page = replaceAttribute(page, "openGraphTitle", "content", metadata.title);
  page = replaceAttribute(page, "openGraphDescription", "content", metadata.description);
  page = replaceAttribute(page, "openGraphUrl", "content", metadata.canonical);
  page = replaceAttribute(page, "twitterCard", "content", metadata.image ? "summary_large_image" : "summary");
  page = replaceAttribute(page, "twitterTitle", "content", metadata.title);
  page = replaceAttribute(page, "twitterDescription", "content", metadata.description);
  const imageTags = metadata.image
    ? `<meta id="openGraphImage" property="og:image" content="${escapeHtml(metadata.image)}" />\n    <meta id="twitterImage" name="twitter:image" content="${escapeHtml(metadata.image)}" />`
    : "";
  const robots = `<meta name="robots" content="${metadata.indexable ? "index,follow" : "noindex,nofollow"}" />`;
  return page.replace("<!-- COMOOTD_ROUTE_META -->", `${imageTags}\n    ${robots}`);
}

async function getStaticShell(request, env) {
  const response = await env.ASSETS.fetch(new URL("/", request.url));
  if (!response.ok) throw new Error("Static app shell is unavailable.");
  return response.text();
}

async function findPublishedEntry(env, spec, slug) {
  const endpoint = new URL(`/rest/v1/${spec.table}`, String(env.SUPABASE_URL || ""));
  endpoint.searchParams.set("select", spec.select);
  endpoint.searchParams.set("slug", `eq.${slug}`);
  endpoint.searchParams.set("status", "eq.published");
  endpoint.searchParams.set("published_at", `lte.${new Date().toISOString()}`);
  const response = await fetch(endpoint, {
    headers: {
      apikey: String(env.SUPABASE_PUBLISHABLE_KEY || ""),
      Authorization: `Bearer ${String(env.SUPABASE_PUBLISHABLE_KEY || "")}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error("Catalogue metadata request failed.");
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findActiveVariantImage(env, productId) {
  if (!productId) return "";
  const endpoint = new URL("/rest/v1/product_variants", String(env.SUPABASE_URL || ""));
  endpoint.searchParams.set("select", "image_path");
  endpoint.searchParams.set("product_id", `eq.${productId}`);
  endpoint.searchParams.set("is_active", "eq.true");
  endpoint.searchParams.set("order", "sort_order.asc");
  endpoint.searchParams.set("limit", "1");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }
  });
  if (!response.ok) return "";
  const rows = await response.json();
  return storageImageUrl(env, Array.isArray(rows) ? rows[0]?.image_path : "");
}

async function errorPage(request, env, status) {
  const origin = siteOrigin(env);
  const title = status === 404 ? "Konten tidak tersedia — COMOOTD" : "COMOOTD sedang menyiapkan halaman ini";
  const description = status === 404 ? "Konten ini belum tersedia atau sudah tidak dipublikasikan." : "Coba muat ulang beberapa saat lagi.";
  try {
    const shell = await getStaticShell(request, env);
    return new Response(injectMetadata(shell, { title, description, canonical: origin, type: "website", image: "", indexable: false }), {
      status,
      headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" }
    });
  } catch {
    return new Response("Halaman tidak tersedia.", { status, headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "no-store" } });
  }
}

async function renderContentPage(request, env, route) {
  const spec = CONTENT_SPECS[route.type];
  if (!spec) return errorPage(request, env, 404);
  if (!String(env.SUPABASE_URL || "").startsWith("https://") || !String(env.SUPABASE_PUBLISHABLE_KEY || "").trim()) return errorPage(request, env, 503);
  try {
    const [shell, entry] = await Promise.all([getStaticShell(request, env), findPublishedEntry(env, spec, route.slug)]);
    if (!entry) {
      return new Response(injectMetadata(shell, {
        title: "Konten tidak tersedia — COMOOTD",
        description: "Konten ini belum tersedia atau sudah tidak dipublikasikan.",
        canonical: siteOrigin(env),
        type: "website",
        image: "",
        indexable: false
      }), { status: 404, headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" } });
    }
    const segment = route.type === "look" ? "looks" : route.type === "product" ? "products" : "journal";
    const image = storageImageUrl(env, entry.cover_image_path) || (route.type === "product" ? await findActiveVariantImage(env, entry.id) : "");
    const metadata = {
      title: clippedText(spec.title(entry), 120),
      description: clippedText(spec.description(entry), 300),
      canonical: `${siteOrigin(env)}/${segment}/${encodeURIComponent(route.slug)}`,
      type: spec.type,
      image,
      indexable: true
    };
    return new Response(injectMetadata(shell, metadata), {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
      }
    });
  } catch {
    return errorPage(request, env, 502);
  }
}

export default {
  async fetch(request, env) {
    const route = ["GET", "HEAD"].includes(request.method) ? routeFromRequest(request) : null;
    const response = route ? await renderContentPage(request, env, route) : await env.ASSETS.fetch(request);
    return request.method === "HEAD" ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }) : response;
  }
};
