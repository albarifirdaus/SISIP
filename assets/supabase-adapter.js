/* global supabase */
/*
 * Cloud adapter for SISIP.
 * It uses only the Supabase project URL and publishable key. Security is enforced
 * by database grants and Row Level Security in supabase/migrations.
 */
(function createSisipCloudAdapter() {
  "use strict";

  const config = window.SISIP_CONFIG || {};
  const bucket = "sisip-media";
  let client;

  const genderToUi = { pria: "Pria", wanita: "Wanita", unisex: "Uniseks" };
  const genderToDb = { Pria: "pria", Wanita: "wanita", Uniseks: "unisex" };

  function validConfig() {
    const key = String(config.supabasePublishableKey || "").trim();
    return Boolean(
      String(config.supabaseUrl || "").startsWith("https://") &&
      key.length > 20 &&
      !key.includes("PASTE_") &&
      window.supabase &&
      typeof window.supabase.createClient === "function"
    );
  }

  function getClient() {
    if (!validConfig()) throw new Error("Supabase belum dikonfigurasi. Isi publishable key di config.js terlebih dahulu.");
    if (!client) {
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return client;
  }

  function slugify(value) {
    return String(value || "look")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "sisip";
  }

  function uniqueSlug(value) {
    return `${slugify(value)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function publicUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || /^data:image\//i.test(path)) return path;
    const { data } = getClient().storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || "";
  }

  function mapProduct(row) {
    const variants = (row.product_variants || [])
      .filter((variant) => variant.is_active !== false)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map((variant) => ({
        id: variant.id,
        name: variant.label,
        hex: variant.color_hex || "#B8AEA1",
        image: publicUrl(variant.image_path)
      }));

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      price: Number(row.price_idr || 0),
      badge: row.badges?.[0] || "",
      styles: row.style_tags || [],
      affiliateUrl: row.affiliate_url,
      artBg: "#D8D0C6",
      artInk: variants[0]?.hex || "#242220",
      image: publicUrl(row.cover_image_path),
      status: row.status || "draft",
      publishedAt: row.published_at || "",
      variants
    };
  }

  function mapLook(row, productMap, fallbackOrder) {
    const items = (row.look_items || [])
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      .map((item) => {
        const variant = item.product_variants;
        const product = variant?.products || productMap.get(variant?.product_id);
        return {
          productId: product?.id || variant?.product_id,
          variantId: variant?.id,
          variantName: variant?.label || "Warna pilihan"
        };
      })
      .filter((item) => Boolean(item.productId));

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      gender: genderToUi[row.gender_target] || "Uniseks",
      styles: row.style_tags || [],
      tone: row.tone || "carbon",
      status: row.status || "draft",
      publishedAt: row.published_at || "",
      popularity: Number(row.popularity || 0),
      createdOrder: Number(row.sort_order || fallbackOrder),
      coverImage: publicUrl(row.cover_image_path),
      items
    };
  }

  function mapArticle(row, index, productMap, lookMap) {
    const blocks = (row.article_blocks || [])
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      .map((block) => ({
        id: block.id,
        position: Number(block.position || 0),
        type: block.block_type,
        content: block.text_content || "",
        level: block.heading_level || null,
        image: publicUrl(block.image_path),
        imagePath: block.image_path || "",
        alt: block.image_alt_text || "",
        caption: block.caption || ""
      }));
    const ctas = (row.article_ctas || [])
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      .map((cta) => {
        const type = cta.target_type;
        const targetId = type === "look" ? cta.look_id : cta.product_id;
        const target = type === "look" ? lookMap.get(targetId) : productMap.get(targetId);
        if (!target) return null;
        return {
          id: cta.id,
          position: Number(cta.position || 0),
          type,
          targetType: type,
          targetId,
          lookId: type === "look" ? targetId : "",
          productId: type === "product" ? targetId : "",
          label: cta.label,
          look: type === "look" ? target : null,
          product: type === "product" ? target : null
        };
      })
      .filter(Boolean);
    return {
      id: row.id,
      number: String(index + 1).padStart(2, "0"),
      title: row.title,
      excerpt: row.excerpt || "",
      body: row.body_markdown || row.excerpt || "",
      category: row.category || "editorial",
      styles: row.style_tags || [],
      tags: row.style_tags || [],
      coverImage: publicUrl(row.cover_image_path),
      coverAlt: row.cover_alt_text || "",
      blocks,
      ctas,
      lookCtas: ctas.filter((cta) => cta.type === "look"),
      productCtas: ctas.filter((cta) => cta.type === "product")
    };
  }

  async function queryRows(query) {
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function loadState({ admin = false } = {}) {
    const db = getClient();
    const now = new Date().toISOString();

    let productsQuery = db
      .from("products")
      .select("id, slug, name, affiliate_url, price_idr, badges, style_tags, cover_image_path, gender_target, status, published_at, sort_order, created_at, product_variants(id, product_id, label, color_name, color_hex, image_path, is_active, sort_order)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    let looksQuery = db
      .from("looks")
      .select("id, slug, title, excerpt, cover_image_path, tone, gender_target, style_tags, status, published_at, popularity, sort_order, created_at, look_items(id, position, product_variants(id, product_id, label, color_name, color_hex, image_path, is_active, sort_order, products(id, slug, name, affiliate_url, price_idr, badges, style_tags, cover_image_path)))")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    let articlesQuery = db
      .from("articles")
      .select("id, slug, title, excerpt, body_markdown, cover_image_path, cover_alt_text, style_tags, category, published_at, status, created_at, article_blocks(id, position, block_type, text_content, heading_level, image_path, image_alt_text, caption), article_ctas(id, position, target_type, look_id, product_id, label)")
      .order("published_at", { ascending: false });
    const newSeriesSlotsQuery = db
      .from("new_series_slots")
      .select("slot, look_id")
      .order("slot", { ascending: true });

    if (!admin) {
      productsQuery = productsQuery.eq("status", "published").lte("published_at", now);
      looksQuery = looksQuery.eq("status", "published").lte("published_at", now);
      articlesQuery = articlesQuery.eq("status", "published").lte("published_at", now);
    }

    const [productRows, lookRows, articleRows, newSeriesSlotRows] = await Promise.all([
      queryRows(productsQuery),
      queryRows(looksQuery),
      queryRows(articlesQuery),
      queryRows(newSeriesSlotsQuery)
    ]);

    const products = productRows.map(mapProduct);
    const productMap = new Map(products.map((product) => [product.id, product]));
    const looks = lookRows.map((row, index) => mapLook(row, productMap, lookRows.length - index));
    const lookMap = new Map(looks.map((look) => [look.id, look]));
    const articles = articleRows.map((row, index) => mapArticle(row, index, productMap, lookMap));
    const newSeriesSlots = newSeriesSlotRows.map((row) => ({
      slot: Number(row.slot),
      lookId: row.look_id || ""
    }));
    const newSeriesLookIds = newSeriesSlots
      .filter((slot) => slot.lookId)
      .sort((a, b) => a.slot - b.slot)
      .map((slot) => slot.lookId);
    return { products, looks, articles, newSeriesSlots, newSeriesLookIds };
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function isAdmin() {
    const session = await getSession();
    if (!session) return false;
    const { data, error } = await getClient().auth.getUser();
    if (error) throw error;
    return String(data?.user?.email || "").trim().toLowerCase() === String(config.adminEmail || "").trim().toLowerCase();
  }

  async function signIn(email, password) {
    const { error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!(await isAdmin())) {
      await getClient().auth.signOut();
      throw new Error("Akun ini bukan admin SISIP.");
    }
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
  }

  function extensionFor(file) {
    const candidate = String(file?.name || "").split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "webp"].includes(candidate) ? candidate : "webp";
  }

  async function uploadImage(file, folder, parentId) {
    if (!file) return "";
    if (!/^image\/(jpeg|png|webp)$/.test(file.type || "")) throw new Error("Gunakan gambar JPEG, PNG, atau WebP.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 5 MB.");
    const path = `${folder}/${parentId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extensionFor(file)}`;
    const { error } = await getClient().storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
    if (error) throw error;
    return path;
  }

  const articleCategories = new Set([
    "style-guide",
    "occasion-guide",
    "trend-watch",
    "editorial",
    "shopping-guide",
    "wardrobe-notes"
  ]);
  const articleBlockTypes = new Set(["paragraph", "heading", "quote", "image"]);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function normalizeArticleText(value, label, { min = 0, max, required = false } = {}) {
    const text = String(value || "").trim();
    if ((required || min > 0) && text.length < min) throw new Error(`${label} wajib diisi.`);
    if (max && text.length > max) throw new Error(`${label} maksimal ${max} karakter.`);
    return text;
  }

  function normalizeArticleCategory(value) {
    const category = String(value || "editorial").trim().toLowerCase();
    if (!articleCategories.has(category)) throw new Error("Kategori Journal belum valid.");
    return category;
  }

  function normalizeArticleStyles(styles) {
    return Array.isArray(styles)
      ? styles.map((style) => String(style || "").trim()).filter(Boolean).slice(0, 12)
      : [];
  }

  function normalizeArticleBlocks(blocks) {
    if (!Array.isArray(blocks) || !blocks.length) throw new Error("Tambahkan minimal satu blok isi artikel.");
    if (blocks.length > 20) throw new Error("Artikel maksimal memiliki 20 blok isi.");

    return blocks.map((rawBlock, index) => {
      const type = String(rawBlock?.type || rawBlock?.blockType || "").trim().toLowerCase();
      if (!articleBlockTypes.has(type)) throw new Error(`Tipe blok ke-${index + 1} belum valid.`);

      if (type === "image") {
        const file = rawBlock?.file || rawBlock?.imageFile || null;
        if (!file) throw new Error(`Pilih foto untuk blok gambar ke-${index + 1}.`);
        const alt = normalizeArticleText(rawBlock?.alt || rawBlock?.imageAlt || rawBlock?.imageAltText, `Alt text gambar ke-${index + 1}`, { min: 1, max: 240, required: true });
        const caption = normalizeArticleText(rawBlock?.caption, `Caption gambar ke-${index + 1}`, { max: 500 });
        return { type, file, alt, caption };
      }

      const limits = type === "heading" ? 240 : type === "quote" ? 800 : 6000;
      const content = normalizeArticleText(rawBlock?.content || rawBlock?.textContent, `Isi blok ke-${index + 1}`, { min: 1, max: limits, required: true });
      const level = type === "heading" ? Number(rawBlock?.level || rawBlock?.headingLevel || 2) : null;
      if (type === "heading" && ![2, 3].includes(level)) throw new Error("Heading artikel hanya dapat memakai level H2 atau H3.");
      return { type, content, level };
    });
  }

  function normalizeArticleCtaEntry(value, type, index) {
    const source = typeof value === "object" && value !== null ? value : { id: value };
    const targetId = String(source.id || source.targetId || (type === "look" ? source.lookId : source.productId) || "").trim();
    if (!uuidPattern.test(targetId)) throw new Error(`Target CTA ${type === "look" ? "look" : "produk"} ke-${index + 1} belum valid.`);
    const defaultLabel = type === "look" ? "Lihat look" : "Lihat produk";
    const label = normalizeArticleText(source.label || defaultLabel, `Label CTA ke-${index + 1}`, { min: 1, max: 80, required: true });
    return { type, targetId, label };
  }

  function normalizeArticleCtas(lookCtas, productCtas) {
    const sourceLooks = Array.isArray(lookCtas) ? lookCtas : [];
    const sourceProducts = Array.isArray(productCtas) ? productCtas : [];
    if (sourceLooks.length > 3 || sourceProducts.length > 3) throw new Error("Maksimal tiga CTA look dan tiga CTA produk per artikel.");

    const ctas = [
      ...sourceLooks.map((value, index) => normalizeArticleCtaEntry(value, "look", index)),
      ...sourceProducts.map((value, index) => normalizeArticleCtaEntry(value, "product", index))
    ];
    if (ctas.length > 6) throw new Error("Artikel maksimal memiliki enam CTA.");
    const duplicateKey = new Set();
    for (const cta of ctas) {
      const key = `${cta.type}:${cta.targetId}`;
      if (duplicateKey.has(key)) throw new Error("Target CTA tidak boleh dipilih lebih dari sekali.");
      duplicateKey.add(key);
    }
    return ctas;
  }

  function articleFallbackBody(title, excerpt, blocks) {
    const pieces = [excerpt, ...blocks.map((block) => block.content || block.alt || block.caption || "")]
      .map((piece) => String(piece || "").trim())
      .filter(Boolean);
    return (pieces.join("\n\n") || `${title} — SISIP Journal`).slice(0, 16000);
  }

  async function assertPublishedArticleTargets(db, ctas, publishedAt) {
    const targetIds = {
      look: ctas.filter((cta) => cta.type === "look").map((cta) => cta.targetId),
      product: ctas.filter((cta) => cta.type === "product").map((cta) => cta.targetId)
    };
    const requests = [];
    if (targetIds.look.length) {
      requests.push(queryRows(db.from("looks").select("id,status,published_at").in("id", targetIds.look)));
    } else {
      requests.push(Promise.resolve([]));
    }
    if (targetIds.product.length) {
      requests.push(queryRows(db.from("products").select("id,status,published_at").in("id", targetIds.product)));
    } else {
      requests.push(Promise.resolve([]));
    }
    const [lookRows, productRows] = await Promise.all(requests);
    const validAt = new Date(publishedAt).getTime();
    const targets = {
      look: new Map(lookRows.map((row) => [row.id, row])),
      product: new Map(productRows.map((row) => [row.id, row]))
    };
    for (const cta of ctas) {
      const target = targets[cta.type].get(cta.targetId);
      if (!target || target.status !== "published" || !target.published_at || new Date(target.published_at).getTime() > validAt) {
        throw new Error(`CTA hanya dapat menunjuk ${cta.type === "look" ? "look" : "produk"} yang sudah published.`);
      }
    }
  }

  function ownArticleStoragePaths(articleId, paths) {
    const prefix = `articles/${articleId}/`;
    return [...new Set((paths || []).filter((path) => typeof path === "string" && path.startsWith(prefix)))];
  }

  function assertShopeeAffiliateUrl(value) {
    let parsed;
    try {
      parsed = new URL(String(value || ""));
    } catch {
      throw new Error("Gunakan link affiliate Shopee Indonesia yang diawali https://.");
    }
    const host = parsed.hostname.toLowerCase();
    const isShopeeIndonesia = host === "shopee.co.id" || host.endsWith(".shopee.co.id") || host === "shope.ee";
    if (parsed.protocol !== "https:" || !isShopeeIndonesia) {
      throw new Error("Gunakan link affiliate Shopee Indonesia yang diawali https://.");
    }
    return parsed.href;
  }

  function assertImageUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("URL foto harus berupa alamat https yang lengkap.");
    }
    if (parsed.protocol !== "https:") throw new Error("URL foto harus menggunakan https://.");
    return parsed.href;
  }

  function normalizeImportKey(value) {
    const key = String(value || "").trim().toUpperCase();
    if (!key) return "";
    if (!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(key)) {
      throw new Error("Kode import hanya boleh berisi huruf, angka, tanda minus, atau garis bawah.");
    }
    return key;
  }

  function normalizeColorHex(value) {
    let hex = String(value || "").trim();
    if (!hex) return "#B8AEA1";
    if (/^#[0-9a-f]{3}$/i.test(hex)) hex = `#${hex.slice(1).split("").map((part) => part + part).join("")}`;
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("Kode warna harus memakai format #RRGGBB.");
    return hex.toUpperCase();
  }

  function normalizeGenderTarget(value) {
    const gender = String(value || "unisex").trim().toLowerCase();
    if (["pria", "wanita", "unisex"].includes(gender)) return gender;
    throw new Error("Gender produk harus pria, wanita, atau unisex.");
  }

  function normalizeProductPayload({ title, price, badge, styles, link, variants, imageUrl, genderTarget, importKey }) {
    const name = String(title || "").trim();
    const amount = Number(price);
    const preparedVariants = Array.isArray(variants) ? variants.map((variant) => {
      const label = String(variant?.name || "").trim();
      if (!label) throw new Error("Setiap produk membutuhkan nama varian warna.");
      return {
        name: label,
        hex: normalizeColorHex(variant?.hex),
        imageUrl: assertImageUrl(variant?.imageUrl)
      };
    }) : [];

    if (!name) throw new Error("Nama produk wajib diisi.");
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Harga referensi harus berupa angka IDR yang lebih dari nol.");
    if (!preparedVariants.length) throw new Error("Produk memerlukan minimal satu varian warna.");

    return {
      title: name,
      price: amount,
      badge: String(badge || "").trim(),
      styles: Array.isArray(styles) ? styles.map((style) => String(style || "").trim()).filter(Boolean).slice(0, 12) : [],
      link: assertShopeeAffiliateUrl(link),
      variants: preparedVariants,
      imageUrl: assertImageUrl(imageUrl),
      genderTarget: normalizeGenderTarget(genderTarget),
      importKey: normalizeImportKey(importKey)
    };
  }

  async function readExistingVariantImages(db, productId) {
    const { data, error } = await db
      .from("product_variants")
      .select("label,image_path")
      .eq("product_id", productId);
    if (error) throw error;
    return new Map((data || []).map((variant) => [variant.label, variant.image_path || ""]));
  }

  async function saveProduct({ title, price, badge, styles, link, variants, imageFile, imageUrl, genderTarget, importKey }) {
    const db = getClient();
    const payload = normalizeProductPayload({ title, price, badge, styles, link, variants, imageUrl, genderTarget, importKey });
    let existing = null;
    if (payload.importKey) {
      const { data, error } = await db
        .from("products")
        .select("id,status,cover_image_path")
        .eq("import_key", payload.importKey)
        .maybeSingle();
      if (error) throw error;
      existing = data;
    }

    let product = existing;
    const created = !product;
    if (created) {
      const { data, error } = await db
        .from("products")
        .insert({
          slug: uniqueSlug(payload.title),
          name: payload.title,
          affiliate_url: payload.link,
          price_idr: payload.price,
          badges: payload.badge ? [payload.badge] : [],
          style_tags: payload.styles,
          gender_target: payload.genderTarget,
          import_key: payload.importKey || null,
          cover_image_path: payload.imageUrl || null,
          status: "draft",
          price_checked_at: new Date().toISOString()
        })
        .select("id,status,cover_image_path")
        .single();
      if (error) throw error;
      product = data;
    }

    let uploadedImagePath = "";
    try {
      uploadedImagePath = await uploadImage(imageFile, "products", product.id);
      const suppliedCoverPath = uploadedImagePath || payload.imageUrl;
      const coverImagePath = suppliedCoverPath || product.cover_image_path || "";

      if (!created) {
        const updatePayload = {
          name: payload.title,
          affiliate_url: payload.link,
          price_idr: payload.price,
          badges: payload.badge ? [payload.badge] : [],
          style_tags: payload.styles,
          gender_target: payload.genderTarget,
          price_checked_at: new Date().toISOString()
        };
        if (suppliedCoverPath) updatePayload.cover_image_path = suppliedCoverPath;
        const { error } = await db.from("products").update(updatePayload).eq("id", product.id);
        if (error) throw error;
      } else if (uploadedImagePath) {
        const { error } = await db.from("products").update({ cover_image_path: uploadedImagePath }).eq("id", product.id);
        if (error) throw error;
      }

      const existingVariantImages = created ? new Map() : await readExistingVariantImages(db, product.id);
      const variantRows = payload.variants.map((variant, index) => ({
        product_id: product.id,
        label: variant.name,
        color_name: variant.name,
        color_hex: variant.hex,
        image_path: variant.imageUrl || coverImagePath || existingVariantImages.get(variant.name) || null,
        sort_order: index
      }));
      const variantRequest = created
        ? db.from("product_variants").insert(variantRows)
        : db.from("product_variants").upsert(variantRows, { onConflict: "product_id,label" });
      const { error: variantError } = await variantRequest;
      if (variantError) throw variantError;

      if (created || product.status === "draft") {
        const { error: publishError } = await db
          .from("products")
          .update({ status: "published", published_at: new Date().toISOString() })
          .eq("id", product.id);
        if (publishError) throw publishError;
      }
      return { id: product.id, created };
    } catch (error) {
      if (created) {
        if (uploadedImagePath) await getClient().storage.from(bucket).remove([uploadedImagePath]);
        await db.from("product_variants").delete().eq("product_id", product.id);
        await db.from("products").delete().eq("id", product.id);
      }
      throw error;
    }
  }

  async function createProduct(input) {
    const result = await saveProduct(input);
    return result.id;
  }

  async function importProducts(groups, onProgress) {
    if (!Array.isArray(groups) || !groups.length) throw new Error("Belum ada produk untuk diimpor.");
    const results = [];
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      try {
        const result = await saveProduct({
          title: group.name,
          price: group.price,
          badge: group.badge,
          styles: group.styles,
          link: group.affiliateUrl,
          variants: group.variants,
          imageUrl: group.coverImageUrl,
          genderTarget: group.genderTarget,
          importKey: group.key
        });
        const item = { key: group.key, name: group.name, ok: true, created: result.created };
        results.push(item);
        if (typeof onProgress === "function") onProgress({ index: index + 1, total: groups.length, ...item });
      } catch (error) {
        const item = { key: group.key, name: group.name, ok: false, error: error?.message || "Produk belum dapat diimpor." };
        results.push(item);
        if (typeof onProgress === "function") onProgress({ index: index + 1, total: groups.length, ...item });
      }
    }
    const createdCount = results.filter((item) => item.ok && item.created).length;
    const updatedCount = results.filter((item) => item.ok && !item.created).length;
    const failedCount = results.filter((item) => !item.ok).length;
    return { createdCount, updatedCount, failedCount, results };
  }

  async function createLook({ title, gender, styles, tone, items, coverFile, popularity = 0 }) {
    const db = getClient();
    const { data: look, error: lookError } = await db
      .from("looks")
      .insert({
        slug: uniqueSlug(title),
        title,
        gender_target: genderToDb[gender] || "unisex",
        style_tags: styles,
        tone,
        popularity,
        status: "draft"
      })
      .select("id")
      .single();
    if (lookError) throw lookError;

    let coverPath = "";
    try {
      coverPath = await uploadImage(coverFile, "looks", look.id);
      if (coverPath) {
        const { error } = await db.from("looks").update({ cover_image_path: coverPath }).eq("id", look.id);
        if (error) throw error;
      }

      const lookItems = items.map((item, index) => ({
        look_id: look.id,
        product_variant_id: item.variantId,
        position: index + 1
      }));
      if (lookItems.some((item) => !item.product_variant_id)) throw new Error("Varian produk belum sinkron. Muat ulang Studio lalu coba lagi.");
      const { error: itemsError } = await db.from("look_items").insert(lookItems);
      if (itemsError) throw itemsError;

      const { error: publishError } = await db
        .from("looks")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", look.id);
      if (publishError) throw publishError;
      return look.id;
    } catch (error) {
      if (coverPath) await getClient().storage.from(bucket).remove([coverPath]);
      await db.from("looks").delete().eq("id", look.id);
      throw error;
    }
  }

  async function importDemoCatalogue({ products, looks }) {
    const db = getClient();
    const sourceProducts = Array.isArray(products) ? products : [];
    const sourceLooks = Array.isArray(looks) ? looks : [];
    if (!sourceProducts.length || !sourceLooks.length) throw new Error("Data sample SISIP belum lengkap.");

    const now = new Date().toISOString();
    const demoLookSlugs = sourceLooks.map((look) => `demo-${slugify(look.id)}`);
    const { error: prepareLooksError } = await db
      .from("looks")
      .update({ status: "draft", published_at: null })
      .in("slug", demoLookSlugs);
    if (prepareLooksError) throw prepareLooksError;

    const variantIds = new Map();
    for (const sourceProduct of sourceProducts) {
      const productSlug = `demo-${slugify(sourceProduct.id)}`;
      const { data: product, error: productError } = await db
        .from("products")
        .upsert({
          slug: productSlug,
          name: sourceProduct.name,
          affiliate_url: assertShopeeAffiliateUrl(sourceProduct.affiliateUrl),
          price_idr: Number(sourceProduct.price || 0),
          badges: sourceProduct.badge ? [sourceProduct.badge] : [],
          style_tags: sourceProduct.styles || [],
          status: "draft",
          published_at: null,
          price_checked_at: now
        }, { onConflict: "slug" })
        .select("id")
        .single();
      if (productError) throw productError;

      const variantRows = (sourceProduct.variants || []).map((variant, index) => ({
        product_id: product.id,
        label: variant.name,
        color_name: variant.name,
        color_hex: variant.hex,
        image_path: null,
        is_active: true,
        sort_order: index
      }));
      if (!variantRows.length) throw new Error(`Produk sample ${sourceProduct.name} belum memiliki varian warna.`);
      const { error: variantsError } = await db
        .from("product_variants")
        .upsert(variantRows, { onConflict: "product_id,label" });
      if (variantsError) throw variantsError;

      const { data: variants, error: readVariantsError } = await db
        .from("product_variants")
        .select("id,label")
        .eq("product_id", product.id);
      if (readVariantsError) throw readVariantsError;
      for (const variant of variants || []) variantIds.set(`${sourceProduct.id}::${variant.label}`, variant.id);

      const { error: publishProductError } = await db
        .from("products")
        .update({ status: "published", published_at: now })
        .eq("id", product.id);
      if (publishProductError) throw publishProductError;
    }

    for (const sourceLook of sourceLooks) {
      const { data: look, error: lookError } = await db
        .from("looks")
        .upsert({
          slug: `demo-${slugify(sourceLook.id)}`,
          title: sourceLook.title,
          gender_target: genderToDb[sourceLook.gender] || "unisex",
          style_tags: sourceLook.styles || [],
          tone: sourceLook.tone || "carbon",
          popularity: Number(sourceLook.popularity || 0),
          sort_order: Number(sourceLook.createdOrder || 0),
          status: "draft",
          published_at: null
        }, { onConflict: "slug" })
        .select("id")
        .single();
      if (lookError) throw lookError;

      const { error: deleteItemsError } = await db.from("look_items").delete().eq("look_id", look.id);
      if (deleteItemsError) throw deleteItemsError;
      const lookItems = (sourceLook.items || []).map((item, index) => ({
        look_id: look.id,
        product_variant_id: variantIds.get(`${item.productId}::${item.variantName}`),
        position: index + 1
      }));
      if (lookItems.length < 2 || lookItems.length > 5 || lookItems.some((item) => !item.product_variant_id)) {
        throw new Error(`Item pada sample “${sourceLook.title}” belum lengkap.`);
      }
      const { error: insertItemsError } = await db.from("look_items").insert(lookItems);
      if (insertItemsError) throw insertItemsError;
      const { error: publishLookError } = await db
        .from("looks")
        .update({ status: "published", published_at: now })
        .eq("id", look.id);
      if (publishLookError) throw publishLookError;
    }

    return { productCount: sourceProducts.length, lookCount: sourceLooks.length };
  }

  async function createArticle({ title, excerpt, category, styles, coverFile, coverAlt, blocks, lookCtas, productCtas }) {
    const db = getClient();
    const articleTitle = normalizeArticleText(title, "Judul artikel", { min: 1, max: 180, required: true });
    const articleExcerpt = normalizeArticleText(excerpt, "Ringkasan artikel", { max: 600 });
    const articleCategory = normalizeArticleCategory(category);
    const articleStyles = normalizeArticleStyles(styles);
    const articleBlocks = normalizeArticleBlocks(blocks);
    const articleCtas = normalizeArticleCtas(lookCtas, productCtas);
    const articleCoverAlt = normalizeArticleText(coverAlt, "Alt text cover", { max: 240 });
    if (coverFile && !articleCoverAlt) throw new Error("Alt text cover wajib diisi saat mengunggah cover artikel.");

    const publishedAt = new Date().toISOString();
    await assertPublishedArticleTargets(db, articleCtas, publishedAt);
    const fallbackBody = articleFallbackBody(articleTitle, articleExcerpt, articleBlocks);
    const { data: article, error: articleError } = await db
      .from("articles")
      .insert({
        slug: uniqueSlug(articleTitle),
        title: articleTitle,
        excerpt: articleExcerpt || null,
        body_markdown: fallbackBody,
        category: articleCategory,
        style_tags: articleStyles,
        cover_alt_text: articleCoverAlt || null,
        status: "draft"
      })
      .select("id")
      .single();
    if (articleError) throw articleError;

    const uploadedPaths = [];
    try {
      const coverPath = await uploadImage(coverFile, "articles", article.id);
      if (coverPath) uploadedPaths.push(coverPath);

      const blockRows = [];
      for (let index = 0; index < articleBlocks.length; index += 1) {
        const block = articleBlocks[index];
        let imagePath = null;
        if (block.type === "image") {
          imagePath = await uploadImage(block.file, "articles", article.id);
          uploadedPaths.push(imagePath);
        }
        blockRows.push({
          article_id: article.id,
          position: index + 1,
          block_type: block.type,
          text_content: block.type === "image" ? null : block.content,
          heading_level: block.type === "heading" ? block.level : null,
          image_path: imagePath,
          image_alt_text: block.type === "image" ? block.alt : null,
          caption: block.type === "image" ? block.caption || null : null
        });
      }
      const { error: blocksError } = await db.from("article_blocks").insert(blockRows);
      if (blocksError) throw blocksError;

      const articleUpdate = { body_markdown: fallbackBody, cover_alt_text: articleCoverAlt || null };
      if (coverPath) articleUpdate.cover_image_path = coverPath;
      const { error: updateError } = await db.from("articles").update(articleUpdate).eq("id", article.id);
      if (updateError) throw updateError;

      if (articleCtas.length) {
        const ctaRows = articleCtas.map((cta, index) => ({
          article_id: article.id,
          position: index + 1,
          target_type: cta.type,
          look_id: cta.type === "look" ? cta.targetId : null,
          product_id: cta.type === "product" ? cta.targetId : null,
          label: cta.label
        }));
        const { error: ctasError } = await db.from("article_ctas").insert(ctaRows);
        if (ctasError) throw ctasError;
      }

      const { error: publishError } = await db
        .from("articles")
        .update({ status: "published", published_at: publishedAt })
        .eq("id", article.id);
      if (publishError) throw publishError;
      return article.id;
    } catch (error) {
      const { error: deleteError } = await db.from("articles").delete().eq("id", article.id);
      if (!deleteError && uploadedPaths.length) {
        await getClient().storage.from(bucket).remove(ownArticleStoragePaths(article.id, uploadedPaths));
      }
      throw error;
    }
  }

  async function deleteArticle(id) {
    const articleId = String(id || "").trim();
    if (!uuidPattern.test(articleId)) throw new Error("Artikel yang akan dihapus belum valid.");
    const db = getClient();
    const { data: article, error: readError } = await db
      .from("articles")
      .select("id, cover_image_path, article_blocks(image_path)")
      .eq("id", articleId)
      .maybeSingle();
    if (readError) throw readError;

    const { error: deleteError } = await db.from("articles").delete().eq("id", articleId);
    if (deleteError) throw deleteError;
    const paths = ownArticleStoragePaths(articleId, [
      article?.cover_image_path,
      ...(article?.article_blocks || []).map((block) => block.image_path)
    ]);
    if (paths.length) {
      const { error: storageError } = await getClient().storage.from(bucket).remove(paths);
      if (storageError) return { deleted: true, mediaCleanupWarning: true };
    }
    return { deleted: true, mediaCleanupWarning: false };
  }

  async function deleteLook(id) {
    const { error } = await getClient().from("looks").delete().eq("id", id);
    if (error) throw error;
  }

  async function deleteProduct(id) {
    const { error } = await getClient().from("products").delete().eq("id", id);
    if (error) throw error;
  }

  async function setNewSeries(lookIds) {
    const ids = Array.isArray(lookIds) ? lookIds.map((id) => String(id || "").trim()) : [];
    if (ids.length !== 5 || ids.some((id) => !id) || new Set(ids).size !== 5) {
      throw new Error("Pilih lima look berbeda untuk New Series.");
    }
    const { error } = await getClient().rpc("set_sisip_new_series", { p_look_ids: ids });
    if (error) throw error;
  }

  window.SISIPCloud = {
    isConfigured: validConfig,
    config,
    loadState,
    getSession,
    isAdmin,
    signIn,
    signOut,
    createProduct,
    importProducts,
    createLook,
    createArticle,
    importDemoCatalogue,
    deleteLook,
    deleteProduct,
    deleteArticle,
    setNewSeries,
    publicUrl
  };
})();

