const CONTENT_SPECS = {
  look: {
    table: "looks",
    select: "id,slug,title,excerpt,cover_image_path,cover_alt_text,style_tags,gender_target,published_at,updated_at",
    title: (row) => `${row.title || "Look"} — COMOOTD Look`,
    description: (row) => {
      const styles = Array.isArray(row.style_tags) ? row.style_tags.filter(Boolean).slice(0, 3) : [];
      return styles.length ? `${styles.join(" · ")} — temukan setiap item dalam look ini di COMOOTD.` : "Temukan setiap item dalam look kurasi COMOOTD ini.";
    },
    type: "website",
    imageAlt: (row) => row.cover_alt_text || `Look ${row.title || "COMOOTD"}`
  },
  product: {
    table: "products",
    select: "id,slug,name,brand,item_type,price_idr,cover_image_path,style_tags,gender_target,is_available,published_at,updated_at",
    title: (row) => `${row.name || "Produk"} — COMOOTD`,
    description: (row) => {
      const price = Number(row.price_idr || 0);
      const styles = Array.isArray(row.style_tags) ? row.style_tags.filter(Boolean).slice(0, 3) : [];
      const formattedPrice = Number.isFinite(price) && price > 0 ? `Rp${price.toLocaleString("id-ID")}` : "Pilihan kurasi COMOOTD";
      return `${formattedPrice}${styles.length ? ` · ${styles.join(" · ")}` : ""} — pilihan kurasi COMOOTD yang mudah dipadankan.`;
    },
    type: "website",
    imageAlt: (row) => row.name || "Produk pilihan COMOOTD"
  },
  article: {
    table: "articles",
    select: "id,slug,title,excerpt,body_markdown,cover_image_path,cover_alt_text,category,style_tags,published_at,updated_at,created_at,article_blocks(position,block_type,text_content,heading_level,image_path,image_alt_text,caption)",
    title: (row) => `${row.title || "Journal"} — COMOOTD Journal`,
    description: (row) => row.excerpt || "Catatan style dari COMOOTD.",
    type: "article",
    imageAlt: (row) => row.cover_alt_text || row.title || "Artikel COMOOTD Journal"
  }
};

const SITE_NAME = "COMOOTD";
const SITE_DESCRIPTION = "Kurasi fashion all-gender untuk membantu menemukan look yang terasa tepat dan mudah dipadankan.";
const SITE_LOCALE = "id_ID";
const SITEMAP_PAGE_SIZE = 1000;
const SITEMAP_URLS_PER_FILE = 5000;
const SITEMAP_CACHE_VERSION = "v2";
const SITEMAP_CACHE_CONTROL = "public, max-age=300, s-maxage=900, stale-while-revalidate=86400";

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
  if (!parts.length) return { type: "home" };
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
    const parsed = new URL(String(env.SITE_ORIGIN || "https://sisip-fashion.pages.dev"));
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Unsupported site origin protocol.");
    return parsed.origin;
  } catch {
    return "https://sisip-fashion.pages.dev";
  }
}

function canonicalUrl(env, pathname = "/") {
  const url = new URL(pathname, siteOrigin(env));
  url.search = "";
  url.hash = "";
  return url.href;
}

function cleanTextList(value, max = 12, itemLimit = 80) {
  const seen = new Set();
  const source = Array.isArray(value) ? value : [];
  return source.reduce((items, entry) => {
    const text = clippedText(entry, itemLimit);
    const key = text.toLocaleLowerCase("id-ID");
    if (text && !seen.has(key) && items.length < max) {
      seen.add(key);
      items.push(text);
    }
    return items;
  }, []);
}

function isoTimestamp(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function publicHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeHeadElementById(html, id) {
  const safeId = escapeRegex(id);
  const script = new RegExp(`<script\\b[^>]*\\bid=(["'])${safeId}\\1[^>]*>[\\s\\S]*?<\\/script\\s*>`, "gi");
  const element = new RegExp(`<(?:meta|link)\\b[^>]*\\bid=(["'])${safeId}\\1[^>]*>`, "gi");
  return html.replace(script, "").replace(element, "");
}

function removeDynamicRouteMetadata(html) {
  return html
    .replace(/<(?:meta|link)\b[^>]*\bdata-comootd-route-meta=(["'])1\1[^>]*>/gi, "")
    .replace(/<script\b[^>]*\bdata-comootd-route-meta=(["'])1\1[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<!-- COMOOTD_ROUTE_META -->/g, "");
}

function metaTag(id, attributes) {
  const values = Object.entries(attributes)
    .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
    .join(" ");
  return `<meta id="${escapeHtml(id)}" data-comootd-route-meta="1" ${values} />`;
}

function linkTag(id, attributes) {
  const values = Object.entries(attributes)
    .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
    .join(" ");
  return `<link id="${escapeHtml(id)}" data-comootd-route-meta="1" ${values} />`;
}

function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function normaliseMetadata(env, source) {
  const canonical = publicHttpUrl(source?.canonical) || canonicalUrl(env, "/");
  const type = ["article", "profile"].includes(source?.type) ? source.type : "website";
  const indexable = source?.indexable !== false;
  return {
    title: clippedText(source?.title || `${SITE_NAME} — Temukan look yang kamu banget.`, 120),
    description: clippedText(source?.description || SITE_DESCRIPTION, 300),
    canonical,
    type,
    image: publicHttpUrl(source?.image),
    imageAlt: clippedText(source?.imageAlt || source?.title || SITE_NAME, 240),
    indexable,
    publishedTime: isoTimestamp(source?.publishedTime),
    modifiedTime: isoTimestamp(source?.modifiedTime),
    section: clippedText(source?.section, 80),
    tags: cleanTextList(source?.tags, 12, 80),
    jsonLd: source?.jsonLd && typeof source.jsonLd === "object" ? source.jsonLd : null
  };
}

function injectMetadata(html, source, env) {
  const metadata = normaliseMetadata(env, source);
  const staticIds = [
    "pageDescription", "canonicalUrl", "openGraphType", "openGraphSiteName", "openGraphTitle",
    "openGraphDescription", "openGraphUrl", "openGraphLocale", "openGraphImage", "openGraphImageAlt",
    "twitterCard", "twitterTitle", "twitterDescription", "twitterUrl", "twitterImage", "twitterImageAlt",
    "robotsDirective", "googlebotDirective", "articlePublishedTime", "articleModifiedTime", "articleSection",
    "comootdStructuredData"
  ];
  let page = removeDynamicRouteMetadata(html);
  for (const id of staticIds) page = removeHeadElementById(page, id);
  page = page.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "");

  const tags = [
    `<title id="pageTitle">${escapeHtml(metadata.title)}</title>`,
    metaTag("pageDescription", { name: "description", content: metadata.description }),
    linkTag("canonicalUrl", { rel: "canonical", href: metadata.canonical }),
    metaTag("openGraphType", { property: "og:type", content: metadata.type }),
    metaTag("openGraphSiteName", { property: "og:site_name", content: SITE_NAME }),
    metaTag("openGraphLocale", { property: "og:locale", content: SITE_LOCALE }),
    metaTag("openGraphTitle", { property: "og:title", content: metadata.title }),
    metaTag("openGraphDescription", { property: "og:description", content: metadata.description }),
    metaTag("openGraphUrl", { property: "og:url", content: metadata.canonical }),
    metaTag("twitterCard", { name: "twitter:card", content: metadata.image ? "summary_large_image" : "summary" }),
    metaTag("twitterTitle", { name: "twitter:title", content: metadata.title }),
    metaTag("twitterDescription", { name: "twitter:description", content: metadata.description }),
    metaTag("twitterUrl", { name: "twitter:url", content: metadata.canonical }),
    metaTag("robotsDirective", { name: "robots", content: metadata.indexable ? "index,follow,max-image-preview:large" : "noindex,nofollow,noarchive" }),
    metaTag("googlebotDirective", { name: "googlebot", content: metadata.indexable ? "index,follow,max-image-preview:large" : "noindex,nofollow,noarchive" })
  ];

  if (metadata.image) {
    tags.push(
      metaTag("openGraphImage", { property: "og:image", content: metadata.image }),
      metaTag("openGraphImageAlt", { property: "og:image:alt", content: metadata.imageAlt }),
      metaTag("twitterImage", { name: "twitter:image", content: metadata.image }),
      metaTag("twitterImageAlt", { name: "twitter:image:alt", content: metadata.imageAlt })
    );
  }
  if (metadata.type === "article") {
    if (metadata.publishedTime) tags.push(metaTag("articlePublishedTime", { property: "article:published_time", content: metadata.publishedTime }));
    if (metadata.modifiedTime) tags.push(metaTag("articleModifiedTime", { property: "article:modified_time", content: metadata.modifiedTime }));
    if (metadata.section) tags.push(metaTag("articleSection", { property: "article:section", content: metadata.section }));
    metadata.tags.forEach((tag, index) => tags.push(metaTag(`articleTag${index}`, { property: "article:tag", content: tag })));
  }
  if (metadata.jsonLd) {
    tags.push(`<script id="comootdStructuredData" type="application/ld+json" data-comootd-route-meta="1">${jsonForScript(metadata.jsonLd)}</script>`);
  }
  const head = tags.map((tag) => `    ${tag}`).join("\n");
  return /<\/head\s*>/i.test(page)
    ? page.replace(/<\/head\s*>/i, `${head}\n  </head>`)
    : `${head}\n${page}`;
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
  endpoint.searchParams.set("select", "id,display_name,avatar_path,updated_at");
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
  endpoint.searchParams.set("select", "user_id,handle,display_name,bio,job_tags,avatar_path,updated_at");
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

function categoryLabel(category) {
  const labels = {
    "style-guide": "Style Guide",
    "occasion-guide": "Occasion Guide",
    "trend-watch": "Trend Watch",
    editorial: "Editorial",
    "shopping-guide": "Shopping Guide",
    "wardrobe-notes": "Wardrobe Notes"
  };
  return labels[String(category || "").trim()] || "Journal";
}

function organisationSchema(env) {
  const origin = siteOrigin(env);
  return {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: SITE_NAME,
    url: canonicalUrl(env, "/")
  };
}

function websiteSchema(env) {
  const origin = siteOrigin(env);
  return {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: canonicalUrl(env, "/"),
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "id-ID",
    publisher: { "@id": `${origin}/#organization` }
  };
}

function pageSchema(metadata, type = "WebPage") {
  const schema = {
    "@type": type,
    "@id": `${metadata.canonical}#webpage`,
    url: metadata.canonical,
    name: metadata.title,
    description: metadata.description,
    inLanguage: "id-ID",
    isPartOf: { "@id": `${new URL(metadata.canonical).origin}/#website` }
  };
  if (metadata.image) schema.primaryImageOfPage = { "@type": "ImageObject", url: metadata.image };
  return schema;
}

function breadcrumbSchema(items) {
  const entries = (items || []).filter((item) => item?.name && item?.url);
  if (entries.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: entries.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: clippedText(item.name, 120),
      item: item.url
    }))
  };
}

function schemaGraph(env, metadata, pageType = "WebPage", entity = null, breadcrumbs = []) {
  const normalized = normaliseMetadata(env, metadata);
  const graph = [organisationSchema(env), websiteSchema(env), pageSchema(normalized, pageType)];
  const breadcrumb = breadcrumbSchema(breadcrumbs);
  if (breadcrumb) graph.push(breadcrumb);
  if (entity) graph.push(entity);
  return { "@context": "https://schema.org", "@graph": graph };
}

function articleText(row) {
  const blocks = Array.isArray(row?.article_blocks) ? row.article_blocks : [];
  const blockText = [...blocks]
    .sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))
    .filter((block) => ["paragraph", "heading", "quote"].includes(block?.block_type))
    .map((block) => String(block?.text_content || "").trim())
    .filter(Boolean)
    .join("\n\n");
  return clippedText(blockText || row?.body_markdown || row?.excerpt || "", 6000);
}

// Social crawlers can use the metadata above, while this compact no-JS article
// fallback gives document-oriented crawlers meaningful, semantic content too.
// It is deliberately limited to the public, published article already fetched
// for the route and is invisible when the JavaScript experience is available.
function articleFallbackBlockMarkup(env, block) {
  const type = String(block?.block_type || "paragraph").toLowerCase();
  const content = String(block?.text_content || "").trim();
  if (type === "image") {
    const image = storageImageUrl(env, block?.image_path);
    if (!image) return "";
    const alt = clippedText(block?.image_alt_text || "Foto artikel COMOOTD", 240);
    const caption = clippedText(block?.caption, 500);
    return `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" loading="lazy" />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
  }
  if (!content) return "";
  if (type === "heading") {
    const level = Number(block?.heading_level);
    const tag = level >= 3 ? "h3" : "h2";
    return `<${tag}>${escapeHtml(clippedText(content, 300))}</${tag}>`;
  }
  if (type === "quote") return `<blockquote>${escapeHtml(clippedText(content, 1200))}</blockquote>`;
  return `<p>${escapeHtml(clippedText(content, 4000))}</p>`;
}

function articleNoscriptFallback(env, row, metadata) {
  const blocks = Array.isArray(row?.article_blocks) ? [...row.article_blocks] : [];
  const blockMarkup = blocks
    .sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))
    .map((block) => articleFallbackBlockMarkup(env, block))
    .filter(Boolean)
    .join("");
  const fallbackMarkup = !blockMarkup
    ? String(row?.body_markdown || row?.excerpt || "")
      .split(/\n\s*\n/)
      .map((paragraph) => clippedText(paragraph, 4000))
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("")
    : "";
  const cover = publicHttpUrl(metadata?.image);
  const category = clippedText(metadata?.section || "Journal", 80);
  const tags = cleanTextList(metadata?.tags, 12, 80);
  const excerpt = clippedText(row?.excerpt, 500);
  const date = isoTimestamp(row?.published_at);
  const headline = clippedText(row?.title || metadata?.title || "COMOOTD Journal", 180);
  return `<noscript data-comootd-route-fallback="article"><main id="comootd-journal-fallback"><article><header><p>${escapeHtml(category)}</p><h1>${escapeHtml(headline)}</h1>${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ""}${date ? `<time datetime="${escapeHtml(date)}">${escapeHtml(date.slice(0, 10))}</time>` : ""}${tags.length ? `<ul>${tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul>` : ""}</header>${cover ? `<figure><img src="${escapeHtml(cover)}" alt="${escapeHtml(metadata?.imageAlt || row?.title || "Artikel COMOOTD")}" /></figure>` : ""}<section>${blockMarkup || fallbackMarkup}</section></article></main></noscript>`;
}

function injectArticleNoscriptFallback(html, fallback) {
  if (!fallback) return html;
  return /<body\b[^>]*>/i.test(html)
    ? html.replace(/<body\b[^>]*>/i, (body) => `${body}\n    ${fallback}`)
    : `${fallback}${html}`;
}

function contentMetadata(env, type, row, image) {
  const spec = CONTENT_SPECS[type];
  const segment = type === "look" ? "looks" : type === "product" ? "products" : "journal";
  const canonical = canonicalUrl(env, `/${segment}/${encodeURIComponent(row.slug)}`);
  const tags = cleanTextList(row.style_tags, 12, 80);
  const metadata = {
    title: clippedText(spec.title(row), 120),
    description: clippedText(spec.description(row), 300),
    canonical,
    type: spec.type,
    image,
    imageAlt: spec.imageAlt(row),
    indexable: true,
    publishedTime: row.published_at,
    modifiedTime: row.updated_at || row.published_at,
    section: type === "article" ? categoryLabel(row.category) : "",
    tags
  };
  const origin = siteOrigin(env);
  const crumbs = [
    { name: SITE_NAME, url: canonicalUrl(env, "/") },
    { name: type === "article" ? "Journal" : type === "look" ? "Looks" : "Products", url: canonicalUrl(env, `/${segment}`) },
    { name: row.title || row.name || "COMOOTD", url: canonical }
  ];
  let entity = null;
  let pageType = "WebPage";
  if (type === "article") {
    pageType = "ArticlePage";
    const publishedTime = isoTimestamp(row.published_at);
    const modifiedTime = isoTimestamp(row.updated_at || row.published_at);
    entity = {
      "@type": "BlogPosting",
      "@id": `${canonical}#article`,
      mainEntityOfPage: { "@id": `${canonical}#webpage` },
      headline: clippedText(row.title, 180),
      description: metadata.description,
      articleSection: metadata.section,
      keywords: tags.join(", "),
      inLanguage: "id-ID",
      author: { "@type": "Organization", "@id": `${origin}/#organization`, name: SITE_NAME },
      publisher: { "@id": `${origin}/#organization` },
      articleBody: articleText(row)
    };
    if (publishedTime) entity.datePublished = publishedTime;
    if (modifiedTime) entity.dateModified = modifiedTime;
    if (image) entity.image = [image];
  } else if (type === "product") {
    pageType = "ItemPage";
    entity = {
      "@type": "Product",
      "@id": `${canonical}#product`,
      name: clippedText(row.name, 160),
      url: canonical,
      description: metadata.description,
      category: clippedText(row.item_type || tags[0] || "Fashion", 120),
      keywords: tags.join(", ")
    };
    if (image) entity.image = [image];
    if (row.brand) entity.brand = { "@type": "Brand", name: clippedText(row.brand, 120) };
    const price = Number(row.price_idr || 0);
    if (Number.isFinite(price) && price > 0) {
      entity.offers = {
        "@type": "Offer",
        priceCurrency: "IDR",
        price: String(Math.round(price)),
        availability: row.is_available === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        url: canonical
      };
    }
  } else {
    pageType = "CollectionPage";
    const publishedTime = isoTimestamp(row.published_at);
    const modifiedTime = isoTimestamp(row.updated_at || row.published_at);
    entity = {
      "@type": "CreativeWork",
      "@id": `${canonical}#look`,
      name: clippedText(row.title, 160),
      url: canonical,
      description: metadata.description,
      keywords: tags.join(", ")
    };
    if (publishedTime) entity.datePublished = publishedTime;
    if (modifiedTime) entity.dateModified = modifiedTime;
    if (image) entity.image = [image];
  }
  metadata.jsonLd = schemaGraph(env, metadata, pageType, entity, crumbs);
  return metadata;
}

function homeMetadata(env) {
  const canonical = canonicalUrl(env, "/");
  const metadata = {
    title: "COMOOTD — Temukan look yang kamu banget.",
    description: SITE_DESCRIPTION,
    canonical,
    type: "website",
    image: "",
    imageAlt: SITE_NAME,
    indexable: true
  };
  metadata.jsonLd = schemaGraph(env, metadata, "WebPage");
  return metadata;
}

function responseHeaders({ cacheControl, indexable = true, contentType = "text/html; charset=UTF-8" } = {}) {
  return {
    "Content-Type": contentType,
    "Content-Language": "id",
    "Cache-Control": cacheControl || "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
    "X-Robots-Tag": indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff"
  };
}

async function errorPage(request, env, status) {
  const title = status === 404 ? "Konten tidak tersedia — COMOOTD" : "COMOOTD sedang menyiapkan halaman ini";
  const description = status === 404 ? "Konten ini belum tersedia atau sudah tidak dipublikasikan." : "Coba muat ulang beberapa saat lagi.";
  const pathname = new URL(request.url).pathname || "/";
  try {
    const shell = await getStaticShell(request, env);
    return new Response(injectMetadata(shell, {
      title,
      description,
      canonical: canonicalUrl(env, pathname),
      type: "website",
      image: "",
      indexable: false
    }, env), {
      status,
      headers: responseHeaders({ cacheControl: "no-store", indexable: false })
    });
  } catch {
    return new Response("Halaman tidak tersedia.", { status, headers: responseHeaders({ contentType: "text/plain; charset=UTF-8", cacheControl: "no-store", indexable: false }) });
  }
}

function curatorMetadata(env, curator) {
  const displayName = clippedText(curator?.display_name || curator?.profile?.display_name || curator?.handle || "Curator", 80);
  const handle = clippedText(curator?.handle || "", 48);
  const tags = Array.isArray(curator?.job_tags) ? curator.job_tags.filter(Boolean).slice(0, 5) : [];
  const bio = clippedText(curator?.bio, 210);
  const identity = handle ? `${displayName} (@${handle})` : displayName;
  const description = bio
    ? `${bio}${tags.length ? ` · ${tags.join(" · ")}` : ""}`
    : `${tags.length ? `${tags.join(" · ")} — ` : ""}Temukan kurasi outfit dari ${displayName} di COMOOTD.`;
  const canonical = canonicalUrl(env, `/curators/${encodeURIComponent(handle)}`);
  const image = storageImageUrl(env, curator?.avatar_path)
    || storageImageUrl(env, curator?.profile?.avatar_path)
    || storageImageUrl(env, curator?.latestLook?.cover_image_path);
  const metadata = {
    title: clippedText(`${identity} — COMOOTD Curator`, 120),
    description: clippedText(description, 300),
    canonical,
    type: "profile",
    image,
    imageAlt: `Profil ${displayName}`,
    indexable: true,
    tags,
    modifiedTime: curator?.updated_at || curator?.profile?.updated_at || ""
  };
  const person = {
    "@type": "Person",
    "@id": `${canonical}#person`,
    name: displayName,
    url: canonical,
    description: metadata.description,
    knowsAbout: tags
  };
  if (image) person.image = image;
  metadata.jsonLd = schemaGraph(env, metadata, "ProfilePage", person, [
    { name: SITE_NAME, url: canonicalUrl(env, "/") },
    { name: "Curators", url: canonicalUrl(env, "/curators") },
    { name: displayName, url: canonical }
  ]);
  return metadata;
}

async function renderCuratorPage(request, env, route) {
  if (!String(env.SUPABASE_URL || "").startsWith("https://") || !String(env.SUPABASE_PUBLISHABLE_KEY || "").trim()) return errorPage(request, env, 503);
  try {
    const [shell, curator] = await Promise.all([getStaticShell(request, env), findActiveCurator(env, route.slug)]);
    if (!curator) {
      return new Response(injectMetadata(shell, {
        title: "Curator tidak tersedia — COMOOTD",
        description: "Profil Curator ini belum tersedia atau sudah tidak aktif.",
        canonical: canonicalUrl(env, `/curators/${encodeURIComponent(route.slug)}`),
        type: "website",
        image: "",
        indexable: false
      }, env), { status: 404, headers: responseHeaders({ cacheControl: "no-store", indexable: false }) });
    }
    return new Response(injectMetadata(shell, curatorMetadata(env, curator), env), {
      headers: responseHeaders()
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
  if (!entry) return null;
  const result = { ...entry, type: "website", image: "", imageAlt: SITE_NAME, indexable: true };
  const label = String(entry.title || "COMOOTD").replace(/\s+—\s+COMOOTD$/i, "");
  result.jsonLd = schemaGraph(env, result, "CollectionPage", null, [
    { name: SITE_NAME, url: canonicalUrl(env, "/") },
    { name: label, url: entry.canonical }
  ]);
  return result;
}

async function renderDirectoryPage(request, env, type) {
  try {
    const shell = await getStaticShell(request, env);
    const metadata = directoryMetadata(env, type);
    if (!metadata) return errorPage(request, env, 404);
    return new Response(injectMetadata(shell, metadata, env), {
      headers: responseHeaders()
    });
  } catch {
    return errorPage(request, env, 502);
  }
}

async function renderContentPage(request, env, route) {
  if (route.type === "home") {
    try {
      const shell = await getStaticShell(request, env);
      return new Response(injectMetadata(shell, homeMetadata(env), env), { headers: responseHeaders() });
    } catch {
      return errorPage(request, env, 502);
    }
  }
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
        canonical: canonicalUrl(env, new URL(request.url).pathname),
        type: "website",
        image: "",
        indexable: false
      }, env), { status: 404, headers: responseHeaders({ cacheControl: "no-store", indexable: false }) });
    }
    const image = storageImageUrl(env, entry.cover_image_path) || (route.type === "product" ? await findActiveVariantImage(env, entry.id) : "");
    const metadata = contentMetadata(env, route.type, entry, image);
    const page = injectMetadata(shell, metadata, env);
    return new Response(route.type === "article" ? injectArticleNoscriptFallback(page, articleNoscriptFallback(env, entry, metadata)) : page, {
      headers: responseHeaders()
    });
  } catch {
    return errorPage(request, env, 502);
  }
}

function hasPublicDatabase(env) {
  return String(env.SUPABASE_URL || "").startsWith("https://") && Boolean(String(env.SUPABASE_PUBLISHABLE_KEY || "").trim());
}

async function fetchSitemapRows(env, table, select, filters = {}) {
  if (!hasPublicDatabase(env)) return [];
  const rows = [];
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  const start = Math.max(0, Number(filters.__offset || 0));
  const total = Math.max(1, Math.min(SITEMAP_URLS_PER_FILE, Number(filters.__limit || SITEMAP_URLS_PER_FILE)));
  const queryFilters = { ...filters };
  delete queryFilters.__offset;
  delete queryFilters.__limit;
  for (let offset = start; rows.length < total; offset += SITEMAP_PAGE_SIZE) {
    const endpoint = new URL(`/rest/v1/${table}`, String(env.SUPABASE_URL || ""));
    endpoint.searchParams.set("select", select);
    endpoint.searchParams.set("order", table === "curator_profiles" ? "updated_at.desc.nullslast" : "published_at.desc.nullslast,updated_at.desc.nullslast");
    endpoint.searchParams.set("limit", String(Math.min(SITEMAP_PAGE_SIZE, total - rows.length)));
    endpoint.searchParams.set("offset", String(offset));
    Object.entries(queryFilters).forEach(([keyName, value]) => endpoint.searchParams.set(keyName, value));
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Sitemap query failed for ${table}.`);
    const page = await response.json();
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    if (page.length < SITEMAP_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchSitemapCount(env, table, filters = {}) {
  if (!hasPublicDatabase(env)) return 0;
  const endpoint = new URL(`/rest/v1/${table}`, String(env.SUPABASE_URL || ""));
  endpoint.searchParams.set("select", table === "curator_profiles" ? "user_id" : "id");
  endpoint.searchParams.set("limit", "1");
  Object.entries(filters).forEach(([keyName, value]) => endpoint.searchParams.set(keyName, value));
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "count=exact",
      Range: "0-0"
    }
  });
  if (!response.ok) throw new Error(`Sitemap count query failed for ${table}.`);
  const match = String(response.headers.get("content-range") || "").match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function sitemapDate(value) {
  const timestamp = isoTimestamp(value);
  return timestamp ? `<lastmod>${escapeHtml(timestamp)}</lastmod>` : "";
}

function sitemapEntry(loc, { lastmod = "", changefreq = "weekly", priority = "0.7" } = {}) {
  return `<url><loc>${escapeHtml(loc)}</loc>${sitemapDate(lastmod)}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

function safeSitemapSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

function safeCuratorHandle(value) {
  const handle = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/.test(handle) ? handle : "";
}

function sitemapCatalogues() {
  return {
    looks: {
      table: "looks",
      select: "slug,published_at,updated_at",
      filters: () => ({ status: "eq.published", published_at: `lte.${new Date().toISOString()}` }),
      path: (row) => {
        const slug = safeSitemapSlug(row?.slug);
        return slug ? `/looks/${encodeURIComponent(slug)}` : "";
      },
      lastmod: (row) => row.updated_at || row.published_at,
      changefreq: "weekly",
      priority: "0.7"
    },
    products: {
      table: "products",
      select: "slug,published_at,updated_at",
      filters: () => ({ status: "eq.published", published_at: `lte.${new Date().toISOString()}` }),
      path: (row) => {
        const slug = safeSitemapSlug(row?.slug);
        return slug ? `/products/${encodeURIComponent(slug)}` : "";
      },
      lastmod: (row) => row.updated_at || row.published_at,
      changefreq: "weekly",
      priority: "0.6"
    },
    journal: {
      table: "articles",
      select: "slug,published_at,updated_at",
      filters: () => ({ status: "eq.published", published_at: `lte.${new Date().toISOString()}` }),
      path: (row) => {
        const slug = safeSitemapSlug(row?.slug);
        return slug ? `/journal/${encodeURIComponent(slug)}` : "";
      },
      lastmod: (row) => row.updated_at || row.published_at,
      changefreq: "monthly",
      priority: "0.8"
    },
    curators: {
      table: "curator_profiles",
      select: "handle,created_at,updated_at",
      filters: () => ({ is_active: "eq.true" }),
      path: (row) => {
        const handle = safeCuratorHandle(row?.handle);
        return handle ? `/curators/${encodeURIComponent(handle)}` : "";
      },
      lastmod: (row) => row.updated_at || row.created_at,
      changefreq: "weekly",
      priority: "0.6"
    }
  };
}

function staticSitemapEntries(env) {
  return [
    sitemapEntry(canonicalUrl(env, "/"), { changefreq: "daily", priority: "1.0" }),
    sitemapEntry(canonicalUrl(env, "/looks"), { changefreq: "daily", priority: "0.9" }),
    sitemapEntry(canonicalUrl(env, "/looks/comootd"), { changefreq: "daily", priority: "0.8" }),
    sitemapEntry(canonicalUrl(env, "/looks/curators"), { changefreq: "daily", priority: "0.8" }),
    sitemapEntry(canonicalUrl(env, "/products"), { changefreq: "daily", priority: "0.8" }),
    sitemapEntry(canonicalUrl(env, "/journal"), { changefreq: "weekly", priority: "0.8" }),
    sitemapEntry(canonicalUrl(env, "/curators"), { changefreq: "weekly", priority: "0.7" })
  ];
}

function sitemapResponse(body) {
  return new Response(body, {
    headers: responseHeaders({
      contentType: "application/xml; charset=UTF-8",
      cacheControl: SITEMAP_CACHE_CONTROL
    })
  });
}

async function cachedSitemapResponse(env, pathname, build) {
  const cache = globalThis.caches?.default;
  let cacheKey = null;
  try {
    cacheKey = new Request(canonicalUrl(env, `/__comootd_sitemap_cache/${SITEMAP_CACHE_VERSION}${pathname}`));
    if (cache && cacheKey) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }
  } catch {
    cacheKey = null;
  }
  const response = await build();
  if (cache && cacheKey && response.ok) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch {
      // Cache availability never blocks a valid sitemap response.
    }
  }
  return response;
}

async function renderSitemapIndex(env) {
  return cachedSitemapResponse(env, "/sitemap.xml", async () => {
    const catalogues = sitemapCatalogues();
    const entries = Object.entries(catalogues);
    const counts = await Promise.allSettled(entries.map(([, config]) => fetchSitemapCount(env, config.table, config.filters())));
    const maps = [canonicalUrl(env, "/sitemap-static.xml")];
    counts.forEach((result, index) => {
      const total = result.status === "fulfilled" ? result.value : 0;
      const type = entries[index][0];
      for (let page = 1; page <= Math.ceil(total / SITEMAP_URLS_PER_FILE); page += 1) {
        maps.push(canonicalUrl(env, `/sitemap-${type}-${page}.xml`));
      }
    });
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.map((loc) => `<sitemap><loc>${escapeHtml(loc)}</loc></sitemap>`).join("")}</sitemapindex>`;
    return sitemapResponse(body);
  });
}

async function renderStaticSitemap(env) {
  return cachedSitemapResponse(env, "/sitemap-static.xml", async () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticSitemapEntries(env).join("")}</urlset>`;
    return sitemapResponse(body);
  });
}

async function renderContentSitemap(env, type, page) {
  const catalogue = sitemapCatalogues()[type];
  const pageNumber = Number(page);
  if (!catalogue || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return new Response("Sitemap tidak tersedia.", { status: 404, headers: responseHeaders({ contentType: "text/plain; charset=UTF-8", cacheControl: "no-store", indexable: false }) });
  }
  const pathname = `/sitemap-${type}-${pageNumber}.xml`;
  return cachedSitemapResponse(env, pathname, async () => {
    const rows = await fetchSitemapRows(env, catalogue.table, catalogue.select, {
      ...catalogue.filters(),
      __offset: (pageNumber - 1) * SITEMAP_URLS_PER_FILE,
      __limit: SITEMAP_URLS_PER_FILE
    });
    const entries = rows.map((row) => {
      const path = catalogue.path(row);
      return path ? sitemapEntry(canonicalUrl(env, path), {
        lastmod: catalogue.lastmod(row),
        changefreq: catalogue.changefreq,
        priority: catalogue.priority
      }) : "";
    }).filter(Boolean);
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`;
    return sitemapResponse(body);
  });
}

function renderRobots(env) {
  const body = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${canonicalUrl(env, "/sitemap.xml")}`,
    ""
  ].join("\n");
  return new Response(body, {
    headers: responseHeaders({
      contentType: "text/plain; charset=UTF-8",
      cacheControl: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    })
  });
}

export default {
  async fetch(request, env) {
    const isReadRequest = ["GET", "HEAD"].includes(request.method);
    const pathname = new URL(request.url).pathname;
    let response;
    if (isReadRequest && pathname === "/robots.txt") response = renderRobots(env);
    else if (isReadRequest && pathname === "/sitemap.xml") response = await renderSitemapIndex(env);
    else if (isReadRequest && pathname === "/sitemap-static.xml") response = await renderStaticSitemap(env);
    else {
      const sitemapMatch = isReadRequest && pathname.match(/^\/sitemap-(looks|products|journal|curators)-(\d+)\.xml$/);
      if (sitemapMatch) response = await renderContentSitemap(env, sitemapMatch[1], sitemapMatch[2]);
      else {
        const route = isReadRequest ? routeFromRequest(request) : null;
        response = route ? await renderContentPage(request, env, route) : await env.ASSETS.fetch(request);
      }
    }
    return request.method === "HEAD" ? new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }) : response;
  }
};
