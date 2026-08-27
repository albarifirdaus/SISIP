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
  // Collection routes are first-class public pages rendered by the app shell.
  // They need an explicit shell fallback because Pages has no physical file at
  // these paths.
  if (parts.length === 1) {
    const directories = {
      curators: "curator-directory",
      looks: "look-directory",
      products: "product-directory",
      journal: "journal-directory"
    };
    return directories[parts[0]] ? { type: directories[parts[0]] } : null;
  }
  if (parts.length !== 2) return null;
  if (parts[0] === "looks" && parts[1] === "comootd") return { type: "comootd-look-directory" };
  if (parts[0] === "looks" && parts[1] === "curators") return { type: "curator-look-directory" };
  const type = parts[0] === "looks"
    ? "look"
    : parts[0] === "products"
      ? "product"
      : parts[0] === "journal"
        ? "article"
        : parts[0] === "curators"
          ? "curator"
          : "";
  if (!type) return null;
  try {
    const slug = decodeURIComponent(parts[1]).trim().toLowerCase();
    const isValid = type === "curator"
      ? /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(slug)
      : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
    return isValid ? { type, slug } : null;
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

async function findProfile(env, userId) {
  if (!userId) return null;
  const endpoint = new URL("/rest/v1/profiles", String(env.SUPABASE_URL || ""));
  endpoint.searchParams.set("select", "id,display_name,avatar_path");
  endpoint.searchParams.set("id", `eq.${userId}`);
  endpoint.searchParams.set("limit", "1");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findLatestPublishedCuratorLook(env, userId) {
  if (!userId) return null;
  const endpoint = new URL("/rest/v1/looks", String(env.SUPABASE_URL || ""));
  endpoint.searchParams.set("select", "cover_image_path");
  endpoint.searchParams.set("creator_id", `eq.${userId}`);
  endpoint.searchParams.set("status", "eq.published");
  endpoint.searchParams.set("published_at", `lte.${new Date().toISOString()}`);
  endpoint.searchParams.set("order", "published_at.desc");
  endpoint.searchParams.set("limit", "1");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findActiveCurator(env, handle) {
  const endpoint = new URL("/rest/v1/curator_profiles", String(env.SUPABASE_URL || ""));
  endpoint.searchParams.set("select", "user_id,handle,display_name,bio,job_tags,avatar_path");
  endpoint.searchParams.set("handle", `eq.${handle}`);
  endpoint.searchParams.set("is_active", "eq.true");
  endpoint.searchParams.set("limit", "1");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }
  });
  if (!response.ok) throw new Error("Curator metadata request failed.");
  const rows = await response.json();
  const curator = Array.isArray(rows) ? rows[0] || null : null;
  if (!curator) return null;
  const [profile, latestLook] = await Promise.all([
    findProfile(env, curator.user_id),
    findLatestPublishedCuratorLook(env, curator.user_id)
  ]);
  return { ...curator, profile, latestLook };
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

function curatorMetadata(env, curator) {
  const displayName = clippedText(curator?.display_name || curator?.profile?.display_name || curator?.handle || "Curator", 80);
  const handle = clippedText(curator?.handle || "", 48);
  const tags = Array.isArray(curator?.job_tags) ? curator.job_tags.filter(Boolean).slice(0, 3) : [];
  const bio = clippedText(curator?.bio, 210);
  const identity = handle ? `${displayName} (@${handle})` : displayName;
  const description = bio
    ? `${bio}${tags.length ? ` · ${tags.join(" · ")}` : ""}`
    : `${tags.length ? `${tags.join(" · ")} — ` : ""}Temukan kurasi outfit dari ${displayName} di COMOOTD.`;
  return {
    title: clippedText(`${identity} — COMOOTD Curator`, 120),
    description: clippedText(description, 300),
    canonical: `${siteOrigin(env)}/curators/${encodeURIComponent(handle)}`,
    type: "profile",
    image: storageImageUrl(env, curator?.avatar_path)
      || storageImageUrl(env, curator?.profile?.avatar_path)
      || storageImageUrl(env, curator?.latestLook?.cover_image_path),
    indexable: true
  };
}

async function renderCuratorPage(request, env, route) {
  if (!String(env.SUPABASE_URL || "").startsWith("https://") || !String(env.SUPABASE_PUBLISHABLE_KEY || "").trim()) return errorPage(request, env, 503);
  try {
    const [shell, curator] = await Promise.all([getStaticShell(request, env), findActiveCurator(env, route.slug)]);
    if (!curator) {
      return new Response(injectMetadata(shell, {
        title: "Curator tidak tersedia — COMOOTD",
        description: "Profil Curator ini belum tersedia atau sudah tidak aktif.",
        canonical: siteOrigin(env),
        type: "website",
        image: "",
        indexable: false
      }), { status: 404, headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" } });
    }
    return new Response(injectMetadata(shell, curatorMetadata(env, curator)), {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
      }
    });
  } catch {
    return errorPage(request, env, 502);
  }
}

function directoryMetadata(env, type) {
  const origin = siteOrigin(env);
  const metadata = {
    "curator-directory": {
      title: "Curators — COMOOTD",
      description: "Temukan sudut pandang, kurasi outfit, dan tautan Shopee dari Curator COMOOTD.",
      canonical: `${origin}/curators`
    },
    "look-directory": {
      title: "Looks — COMOOTD",
      description: "Jelajahi kurasi outfit COMOOTD untuk berbagai style, occasion, dan mood.",
      canonical: `${origin}/looks`
    },
    "comootd-look-directory": {
      title: "Looks by COMOOTD — COMOOTD",
      description: "Kurasi editorial resmi COMOOTD. Setiap look dilengkapi item-by-item dan tautan Shopee.",
      canonical: `${origin}/looks/comootd`
    },
    "curator-look-directory": {
      title: "Looks by Curators — COMOOTD",
      description: "Temukan outfit pilihan dari fashion people dan Curator COMOOTD.",
      canonical: `${origin}/looks/curators`
    },
    "product-directory": {
      title: "Products — COMOOTD",
      description: "Produk fashion pilihan yang muncul dalam kurasi COMOOTD dan siap dibeli lewat Shopee.",
      canonical: `${origin}/products`
    },
    "journal-directory": {
      title: "Journal — COMOOTD",
      description: "Catatan style, panduan mix-and-match, dan referensi fashion dari COMOOTD.",
      canonical: `${origin}/journal`
    }
  };
  const entry = metadata[type];
  return entry ? { ...entry, type: "website", image: "", indexable: true } : null;
}

async function renderDirectoryPage(request, env, type) {
  try {
    const shell = await getStaticShell(request, env);
    const metadata = directoryMetadata(env, type);
    if (!metadata) return errorPage(request, env, 404);
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

async function renderContentPage(request, env, route) {
  if (route.type.endsWith("directory")) return renderDirectoryPage(request, env, route.type);
  if (route.type === "curator") return renderCuratorPage(request, env, route);
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
