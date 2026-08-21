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
      popularity: Number(row.popularity || 0),
      createdOrder: Number(row.sort_order || fallbackOrder),
      coverImage: publicUrl(row.cover_image_path),
      items
    };
  }

  function mapArticle(row, index) {
    return {
      id: row.id,
      number: String(index + 1).padStart(2, "0"),
      title: row.title,
      excerpt: row.excerpt || "",
      body: row.body_markdown || row.excerpt || ""
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
      .select("id, slug, title, excerpt, body_markdown, published_at, status, created_at")
      .order("published_at", { ascending: false });

    if (!admin) {
      productsQuery = productsQuery.eq("status", "published").lte("published_at", now);
      looksQuery = looksQuery.eq("status", "published").lte("published_at", now);
      articlesQuery = articlesQuery.eq("status", "published").lte("published_at", now);
    }

    const [productRows, lookRows, articleRows] = await Promise.all([
      queryRows(productsQuery),
      queryRows(looksQuery),
      queryRows(articlesQuery)
    ]);

    const products = productRows.map(mapProduct);
    const productMap = new Map(products.map((product) => [product.id, product]));
    const looks = lookRows.map((row, index) => mapLook(row, productMap, lookRows.length - index));
    const articles = articleRows.map(mapArticle);
    return { products, looks, articles };
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

  function assertShopeeAffiliateUrl(value) {
    const parsed = new URL(String(value || ""));
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || !(host === "shopee.co.id" || host.endsWith(".shopee.co.id"))) {
      throw new Error("Gunakan link affiliate Shopee Indonesia yang diawali https://.");
    }
    return parsed.href;
  }

  async function createProduct({ title, price, badge, styles, link, variants, imageFile }) {
    const db = getClient();
    const affiliateUrl = assertShopeeAffiliateUrl(link);
    const { data: product, error: productError } = await db
      .from("products")
      .insert({
        slug: uniqueSlug(title),
        name: title,
        affiliate_url: affiliateUrl,
        price_idr: price,
        badges: badge ? [badge] : [],
        style_tags: styles,
        status: "draft",
        price_checked_at: new Date().toISOString()
      })
      .select("id")
      .single();
    if (productError) throw productError;

    let imagePath = "";
    try {
      imagePath = await uploadImage(imageFile, "products", product.id);
      if (imagePath) {
        const { error } = await db.from("products").update({ cover_image_path: imagePath }).eq("id", product.id);
        if (error) throw error;
      }

      const variantRows = variants.map((variant, index) => ({
        product_id: product.id,
        label: variant.name,
        color_name: variant.name,
        color_hex: variant.hex,
        image_path: imagePath || null,
        sort_order: index
      }));
      const { error: variantError } = await db.from("product_variants").insert(variantRows);
      if (variantError) throw variantError;

      const { error: publishError } = await db
        .from("products")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", product.id);
      if (publishError) throw publishError;
      return product.id;
    } catch (error) {
      if (imagePath) await getClient().storage.from(bucket).remove([imagePath]);
      await db.from("product_variants").delete().eq("product_id", product.id);
      await db.from("products").delete().eq("id", product.id);
      throw error;
    }
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

  async function deleteLook(id) {
    const { error } = await getClient().from("looks").delete().eq("id", id);
    if (error) throw error;
  }

  async function deleteProduct(id) {
    const { error } = await getClient().from("products").delete().eq("id", id);
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
    createLook,
    importDemoCatalogue,
    deleteLook,
    deleteProduct,
    publicUrl
  };
})();

