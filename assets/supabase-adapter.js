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

  function authRedirectUrl() {
    const configuredUrl = String(config.siteUrl || "").trim();
    if (/^https?:\/\//i.test(configuredUrl)) return configuredUrl.replace(/\/+$/, "");
    if (window.location.protocol === "http:" || window.location.protocol === "https:") return window.location.origin;
    return "";
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
      genderTarget: row.gender_target || "unisex",
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

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function splitStoredList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    return String(value || "")
      .split(/[,;\n|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function optionalNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function mapOutfitRecommendation(row, productMap, lookMap) {
    const targetType = row.target_type === "look" ? "look" : "product";
    const lookId = targetType === "look" ? row.look_id || "" : "";
    const productId = targetType === "product" ? row.product_id || "" : "";
    const targetId = targetType === "look" ? lookId : productId;
    const relatedLook = Array.isArray(row.looks) ? row.looks[0] : row.looks;
    const relatedProduct = Array.isArray(row.products) ? row.products[0] : row.products;
    const look = lookMap?.get(lookId) || relatedLook || null;
    const product = productMap?.get(productId) || relatedProduct || null;

    return {
      id: row.id,
      position: Number(row.position || 0),
      type: targetType,
      targetType,
      targetId,
      label: row.label || (targetType === "look" ? "Lihat look" : "Lihat produk"),
      lookId,
      productId,
      look,
      product
    };
  }

  function readAdminNote(row) {
    const source = Array.isArray(row.outfit_request_admin_notes)
      ? row.outfit_request_admin_notes[0]
      : row.outfit_request_admin_notes;
    return String(source?.note || "").trim();
  }

  function mapOutfitRequest(row, { productMap, lookMap, includeAdminNote = false } = {}) {
    const recommendations = asArray(row.outfit_request_recommendations)
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      .map((recommendation) => mapOutfitRecommendation(recommendation, productMap, lookMap));
    const result = {
      id: row.id,
      requesterId: row.requester_id || "",
      requesterName: row.requester_name || "",
      requesterEmail: row.requester_email || "",
      genderTarget: row.gender_target || null,
      occasion: row.occasion || "",
      styleTags: asArray(row.style_tags).map((tag) => String(tag || "").trim()).filter(Boolean),
      budgetMin: optionalNumber(row.budget_min_idr),
      budgetMax: optionalNumber(row.budget_max_idr),
      preferredColors: splitStoredList(row.preferred_colors),
      preferredColorsText: String(row.preferred_colors || "").trim(),
      message: row.message || "",
      status: row.status || "new",
      responseMessage: row.response_message || "",
      respondedAt: row.responded_at || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || "",
      recommendations
    };
    if (includeAdminNote) result.adminNote = readAdminNote(row);
    return result;
  }

  const outfitRequestSelect = "id, requester_id, requester_name, requester_email, gender_target, occasion, style_tags, budget_min_idr, budget_max_idr, preferred_colors, message, status, response_message, responded_at, created_at, updated_at, outfit_request_recommendations(id, position, target_type, look_id, product_id, label)";
  const adminOutfitRequestSelect = `${outfitRequestSelect}, outfit_request_admin_notes(note, created_at, updated_at)`;

  async function loadState({ admin = false } = {}) {
    const db = getClient();
    const now = new Date().toISOString();

    if (admin && !(await isAdmin())) throw new Error("Masuk sebagai admin COMOOTD untuk membuka Studio.");

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
    const outfitRequestsQuery = admin
      ? db.from("outfit_requests").select(adminOutfitRequestSelect).order("created_at", { ascending: false })
      : null;

    if (!admin) {
      productsQuery = productsQuery.eq("status", "published").lte("published_at", now);
      looksQuery = looksQuery.eq("status", "published").lte("published_at", now);
      articlesQuery = articlesQuery.eq("status", "published").lte("published_at", now);
    }

    const [productRows, lookRows, articleRows, newSeriesSlotRows, outfitRequestRows] = await Promise.all([
      queryRows(productsQuery),
      queryRows(looksQuery),
      queryRows(articlesQuery),
      queryRows(newSeriesSlotsQuery),
      outfitRequestsQuery ? queryRows(outfitRequestsQuery) : Promise.resolve([])
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
    const requests = admin
      ? outfitRequestRows.map((row) => mapOutfitRequest(row, { productMap, lookMap, includeAdminNote: true }))
      : [];
    return { products, looks, articles, newSeriesSlots, newSeriesLookIds, requests };
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  const memberGenderTargets = new Set(["pria", "wanita", "unisex"]);
  const outfitRequestStatuses = new Set(["new", "reviewing", "replied", "closed", "spam"]);

  function hasOwn(source, key) {
    return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
  }

  function assertObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} belum valid.`);
    return value;
  }

  function firstDefined(source, keys) {
    for (const key of keys) {
      if (hasOwn(source, key)) return { provided: true, value: source[key] };
    }
    return { provided: false, value: undefined };
  }

  function normalizeEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Masukkan alamat email yang valid.");
    }
    return email;
  }

  function normalizePassword(value) {
    const password = String(value || "");
    if (password.length < 6 || password.length > 128) throw new Error("Password harus berisi 6–128 karakter.");
    return password;
  }

  function normalizeUserText(value, label, { required = false, min = 0, max = 3000 } = {}) {
    if (value !== null && value !== undefined && typeof value !== "string" && typeof value !== "number") {
      throw new Error(`${label} belum valid.`);
    }
    const text = String(value || "").trim().replace(/\s+/g, " ");
    if ((required || min > 0) && text.length < min) throw new Error(`${label} wajib diisi.`);
    if (text.length > max) throw new Error(`${label} maksimal ${max} karakter.`);
    return text;
  }

  function normalizeDisplayName(value) {
    return normalizeUserText(value, "Nama panggilan", { required: true, min: 1, max: 80 });
  }

  function normalizeMemberTagList(value, label, { max = 12, itemMax = 60 } = {}) {
    if (value === null || value === undefined || value === "") return [];
    if (!Array.isArray(value) && typeof value !== "string") throw new Error(`${label} belum valid.`);
    const source = Array.isArray(value) ? value : value.split(/[,;\n|]/);
    const items = [...new Set(source.map((item) => normalizeUserText(item, label, { max: itemMax })).filter(Boolean))];
    if (items.length > max) throw new Error(`${label} maksimal ${max} pilihan.`);
    return items;
  }

  function normalizeGenderPreference(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw || raw === "prefer tidak menyebutkan" || raw === "tidak menyebutkan") return null;
    if (raw === "pria" || raw === "male" || raw === "men") return "pria";
    if (raw === "wanita" || raw === "female" || raw === "women") return "wanita";
    if (raw === "unisex" || raw === "uniseks" || raw === "all") return "unisex";
    if (memberGenderTargets.has(raw)) return raw;
    throw new Error("Gender harus pria, wanita, unisex, atau dikosongkan.");
  }

  function normalizeIdrAmount(value, label) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const raw = typeof value === "number" ? String(value) : String(value).trim().replace(/^rp\.?\s*/i, "").replace(/[.\s,]/g, "");
    if (!/^\d+$/.test(raw)) throw new Error(`${label} harus berupa angka IDR.`);
    const amount = Number(raw);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2147483647) throw new Error(`${label} belum valid.`);
    return amount;
  }

  function normalizeBoolean(value, label) {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    throw new Error(`${label} belum valid.`);
  }

  function configuredAdminEmail() {
    return String(config.adminEmail || "").trim().toLowerCase();
  }

  function isAdminEmail(email) {
    const adminEmail = configuredAdminEmail();
    return Boolean(adminEmail) && String(email || "").trim().toLowerCase() === adminEmail;
  }

  function mapAuthUser(user) {
    if (!user?.id) return null;
    const email = String(user.email || "").trim().toLowerCase();
    return {
      id: user.id,
      email,
      displayName: String(user.user_metadata?.display_name || "").trim(),
      // This flag only controls the client experience. Supabase RLS remains the authority for admin access.
      isAdmin: isAdminEmail(email)
    };
  }

  async function getCurrentUser() {
    const { data, error } = await getClient().auth.getUser();
    if (error) throw error;
    return mapAuthUser(data?.user || null);
  }

  async function isAdmin() {
    return Boolean((await getCurrentUser())?.isAdmin);
  }

  async function signInMember(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({
      email: normalizeEmail(email),
      password: normalizePassword(password)
    });
    if (error) throw error;
    return mapAuthUser(data?.user || null);
  }

  async function signInAdmin(email, password) {
    if (!configuredAdminEmail()) throw new Error("Email admin belum dikonfigurasi di COMOOTD.");
    const user = await signInMember(email, password);
    if (!user?.isAdmin) {
      try {
        await signOut();
      } catch (signOutError) {
        console.warn("Sesi non-admin tidak dapat diakhiri secara otomatis.", signOutError);
      }
      throw new Error("Akun ini bukan admin COMOOTD.");
    }
    return user;
  }

  async function signUpMember({ email, password, displayName }) {
    const redirectUrl = authRedirectUrl();
    const { data, error } = await getClient().auth.signUp({
      email: normalizeEmail(email),
      password: normalizePassword(password),
      options: {
        data: { display_name: normalizeDisplayName(displayName) },
        ...(redirectUrl ? { emailRedirectTo: redirectUrl } : {})
      }
    });
    if (error) throw error;
    // With Confirm email enabled, Supabase returns an obfuscated user (with no
    // identities) when this address may already be registered. Keep the UI
    // generic so we do not expose account information, while avoiding a false
    // "account created" message.
    const possiblyExistingAccount = !data?.session
      && Array.isArray(data?.user?.identities)
      && data.user.identities.length === 0;
    return {
      user: mapAuthUser(data?.user || null),
      needsEmailConfirmation: !data?.session,
      possiblyExistingAccount
    };
  }

  async function resendMemberConfirmation(email) {
    const redirectUrl = authRedirectUrl();
    const { error } = await getClient().auth.resend({
      type: "signup",
      email: normalizeEmail(email),
      options: redirectUrl ? { emailRedirectTo: redirectUrl } : undefined
    });
    if (error) throw error;
  }

  function onAuthStateChange(listener) {
    if (typeof listener !== "function") throw new Error("Listener autentikasi belum valid.");
    const { data } = getClient().auth.onAuthStateChange((event, session) => {
      try {
        listener(event, mapAuthUser(session?.user || null));
      } catch (error) {
        console.error("Listener autentikasi SISIP gagal dijalankan.", error);
      }
    });
    return () => data.subscription.unsubscribe();
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
  }

  function mapMemberPreferences(row) {
    return {
      genderTarget: row?.gender_target || null,
      styleTags: asArray(row?.style_tags).map((tag) => String(tag || "").trim()).filter(Boolean),
      occasionTags: asArray(row?.occasion_tags).map((tag) => String(tag || "").trim()).filter(Boolean),
      preferredColors: asArray(row?.preferred_colors).map((tag) => String(tag || "").trim()).filter(Boolean),
      avoidedColors: asArray(row?.avoided_colors).map((tag) => String(tag || "").trim()).filter(Boolean),
      budgetMin: optionalNumber(row?.budget_min_idr),
      budgetMax: optionalNumber(row?.budget_max_idr),
      onboardingCompleted: Boolean(row?.onboarding_completed)
    };
  }

  async function getMemberProfile() {
    const user = await getCurrentUser();
    if (!user) return null;
    const db = getClient();
    const [profileResult, preferencesResult] = await Promise.all([
      db.from("profiles").select("id, display_name").eq("id", user.id).maybeSingle(),
      db.from("user_preferences").select("user_id, gender_target, style_tags, occasion_tags, preferred_colors, avoided_colors, budget_min_idr, budget_max_idr, onboarding_completed").eq("user_id", user.id).maybeSingle()
    ]);
    if (profileResult.error) throw profileResult.error;
    if (preferencesResult.error) throw preferencesResult.error;
    return {
      user,
      profile: {
        displayName: String(profileResult.data?.display_name || user.displayName || "COMOOTD Member").trim()
      },
      preferences: mapMemberPreferences(preferencesResult.data)
    };
  }

  async function saveMemberProfile(input) {
    const source = assertObject(input, "Profil member");
    const current = await getMemberProfile();
    if (!current) throw new Error("Masuk terlebih dahulu untuk menyimpan profil.");
    const db = getClient();
    const profileSource = source.profile && typeof source.profile === "object" && !Array.isArray(source.profile) ? source.profile : source;
    const preferencesSource = source.preferences && typeof source.preferences === "object" && !Array.isArray(source.preferences) ? source.preferences : source;
    const displayNameInput = firstDefined(profileSource, ["displayName", "display_name"]);
    const previous = current.preferences || mapMemberPreferences(null);

    const pickPreference = (keys, fallback) => {
      const match = firstDefined(preferencesSource, keys);
      return match.provided ? match.value : fallback;
    };
    const budgetMin = normalizeIdrAmount(pickPreference(["budgetMin", "budget_min_idr"], previous.budgetMin), "Budget minimum");
    const budgetMax = normalizeIdrAmount(pickPreference(["budgetMax", "budget_max_idr"], previous.budgetMax), "Budget maksimum");
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      throw new Error("Budget maksimum tidak boleh lebih kecil dari budget minimum.");
    }
    const onboardingInput = firstDefined(preferencesSource, ["onboardingCompleted", "onboarding_completed"]);
    const completeOnboarding = firstDefined(source, ["completeOnboarding", "complete_onboarding"]);
    const onboardingCompleted = completeOnboarding.provided && normalizeBoolean(completeOnboarding.value, "Status onboarding")
      ? true
      : onboardingInput.provided
        ? normalizeBoolean(onboardingInput.value, "Status onboarding")
        : previous.onboardingCompleted;
    const preferenceRow = {
      user_id: current.user.id,
      gender_target: normalizeGenderPreference(pickPreference(["genderTarget", "gender_target"], previous.genderTarget)),
      style_tags: normalizeMemberTagList(pickPreference(["styleTags", "style_tags"], previous.styleTags), "Pilihan gaya", { max: 10 }),
      occasion_tags: normalizeMemberTagList(pickPreference(["occasionTags", "occasion_tags"], previous.occasionTags), "Pilihan occasion", { max: 10 }),
      preferred_colors: normalizeMemberTagList(pickPreference(["preferredColors", "preferred_colors"], previous.preferredColors), "Warna favorit", { max: 10 }),
      avoided_colors: normalizeMemberTagList(pickPreference(["avoidedColors", "avoided_colors"], previous.avoidedColors), "Warna yang dihindari", { max: 10 }),
      budget_min_idr: budgetMin,
      budget_max_idr: budgetMax,
      onboarding_completed: Boolean(onboardingCompleted)
    };

    if (displayNameInput.provided) {
      const { error } = await db.from("profiles").update({ display_name: normalizeDisplayName(displayNameInput.value) }).eq("id", current.user.id);
      if (error) throw error;
    }
    const { error: preferenceError } = await db.from("user_preferences").upsert(preferenceRow, { onConflict: "user_id" });
    if (preferenceError) throw preferenceError;
    return getMemberProfile();
  }

  function assertUuid(value, label) {
    const id = String(value || "").trim();
    if (!uuidPattern.test(id)) throw new Error(`${label} belum valid.`);
    return id;
  }

  function normalizeOutfitRequestPayload(input) {
    const source = assertObject(input, "Request outfit");
    const occasion = normalizeUserText(firstDefined(source, ["occasion", "need"]).value, "Acara", { required: true, min: 2, max: 160 });
    const styleTags = normalizeMemberTagList(firstDefined(source, ["styleTags", "style_tags", "styles", "style"]).value, "Arah gaya");
    const preferredColors = normalizeMemberTagList(firstDefined(source, ["preferredColors", "preferred_colors", "colors", "color"]).value, "Warna pilihan");
    const budgetMin = normalizeIdrAmount(firstDefined(source, ["budgetMin", "budget_min_idr"]).value, "Budget minimum");
    const budgetMax = normalizeIdrAmount(firstDefined(source, ["budgetMax", "budget_max_idr"]).value, "Budget maksimum");
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      throw new Error("Budget maksimum tidak boleh lebih kecil dari budget minimum.");
    }
    const messageInput = firstDefined(source, ["message", "notes", "note"]);
    const message = normalizeUserText(messageInput.value, "Catatan request", { max: 3000 }) || "Tidak ada catatan tambahan.";
    return {
      occasion,
      gender_target: normalizeGenderPreference(firstDefined(source, ["genderTarget", "gender_target", "gender"]).value),
      style_tags: styleTags,
      budget_min_idr: budgetMin,
      budget_max_idr: budgetMax,
      preferred_colors: preferredColors.join(", ") || null,
      message
    };
  }

  async function createOutfitRequest(input) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Masuk terlebih dahulu untuk mengirim request outfit.");
    if (user.isAdmin) throw new Error("Gunakan akun member untuk mengirim request outfit.");
    const { data, error } = await getClient()
      .from("outfit_requests")
      .insert(normalizeOutfitRequestPayload(input))
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async function loadMyOutfitRequests() {
    const user = await getCurrentUser();
    if (!user) return [];
    const rows = await queryRows(
      getClient()
        .from("outfit_requests")
        .select(outfitRequestSelect)
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false })
    );
    return rows.map((row) => mapOutfitRequest(row));
  }

  async function loadOutfitRequests() {
    if (!(await isAdmin())) throw new Error("Masuk sebagai admin COMOOTD untuk membuka request outfit.");
    const db = getClient();
    const [requestRows, productRows, lookRows] = await Promise.all([
      queryRows(db.from("outfit_requests").select(adminOutfitRequestSelect).order("created_at", { ascending: false })),
      queryRows(db.from("products").select("id, slug, name, affiliate_url, price_idr, badges, style_tags, cover_image_path, gender_target, status, published_at, product_variants(id, product_id, label, color_name, color_hex, image_path, is_active, sort_order)")),
      queryRows(db.from("looks").select("id, slug, title, excerpt, cover_image_path, tone, gender_target, style_tags, status, published_at, popularity, sort_order, created_at, look_items(id, position, product_variants(id, product_id, label, color_name, color_hex, image_path, is_active, sort_order))"))
    ]);
    const products = productRows.map(mapProduct);
    const productMap = new Map(products.map((product) => [product.id, product]));
    const looks = lookRows.map((row, index) => mapLook(row, productMap, lookRows.length - index));
    const lookMap = new Map(looks.map((look) => [look.id, look]));
    return requestRows.map((row) => mapOutfitRequest(row, { productMap, lookMap, includeAdminNote: true }));
  }

  function normalizeOutfitRecommendation(value, index) {
    const source = assertObject(value, `Rekomendasi ke-${index + 1}`);
    const type = String(source.targetType || source.target_type || source.type || "").trim().toLowerCase();
    if (type !== "look" && type !== "product") throw new Error(`Tipe rekomendasi ke-${index + 1} belum valid.`);
    const targetId = assertUuid(source.targetId || (type === "look" ? source.lookId || source.look_id : source.productId || source.product_id), `Target rekomendasi ke-${index + 1}`);
    const label = normalizeUserText(source.label || (type === "look" ? "Lihat look" : "Lihat produk"), `Label rekomendasi ke-${index + 1}`, { required: true, min: 1, max: 80 });
    return { type, targetId, label };
  }

  function normalizeOutfitRecommendations(value) {
    if (!Array.isArray(value)) throw new Error("Daftar rekomendasi belum valid.");
    if (value.length > 6) throw new Error("Maksimal enam rekomendasi per request.");
    const recommendations = value.map(normalizeOutfitRecommendation);
    const targetKeys = new Set();
    for (const recommendation of recommendations) {
      const key = `${recommendation.type}:${recommendation.targetId}`;
      if (targetKeys.has(key)) throw new Error("Look atau produk yang sama tidak boleh dipilih lebih dari sekali.");
      targetKeys.add(key);
    }
    return recommendations;
  }

  async function assertPublishedOutfitRecommendationTargets(db, recommendations) {
    const lookIds = recommendations.filter((item) => item.type === "look").map((item) => item.targetId);
    const productIds = recommendations.filter((item) => item.type === "product").map((item) => item.targetId);
    const [lookRows, productRows] = await Promise.all([
      lookIds.length ? queryRows(db.from("looks").select("id, status, published_at").in("id", lookIds)) : Promise.resolve([]),
      productIds.length ? queryRows(db.from("products").select("id, status, published_at").in("id", productIds)) : Promise.resolve([])
    ]);
    const now = Date.now();
    const targets = {
      look: new Map(lookRows.map((row) => [row.id, row])),
      product: new Map(productRows.map((row) => [row.id, row]))
    };
    for (const recommendation of recommendations) {
      const target = targets[recommendation.type].get(recommendation.targetId);
      if (!target || target.status !== "published" || !target.published_at || Number.isNaN(new Date(target.published_at).getTime()) || new Date(target.published_at).getTime() > now) {
        throw new Error(`Rekomendasi hanya dapat menunjuk ${recommendation.type === "look" ? "look" : "produk"} yang sudah published.`);
      }
    }
  }

  function recommendationRowsForRequest(requestId, recommendations) {
    return recommendations.map((recommendation, index) => ({
      request_id: requestId,
      position: index + 1,
      target_type: recommendation.type,
      look_id: recommendation.type === "look" ? recommendation.targetId : null,
      product_id: recommendation.type === "product" ? recommendation.targetId : null,
      label: recommendation.label
    }));
  }

  async function replaceOutfitRecommendations(db, requestId, recommendations) {
    const existing = await queryRows(
      db.from("outfit_request_recommendations").select("position, target_type, look_id, product_id, label").eq("request_id", requestId).order("position", { ascending: true })
    );
    const { error: deleteError } = await db.from("outfit_request_recommendations").delete().eq("request_id", requestId);
    if (deleteError) throw deleteError;
    try {
      if (recommendations.length) {
        const { error } = await db.from("outfit_request_recommendations").insert(recommendationRowsForRequest(requestId, recommendations));
        if (error) throw error;
      }
    } catch (error) {
      if (existing.length) {
        const { error: restoreError } = await db.from("outfit_request_recommendations").insert(existing.map((row) => ({ ...row, request_id: requestId })));
        if (restoreError) console.error("Rekomendasi request sebelumnya tidak dapat dipulihkan.", restoreError);
      }
      throw error;
    }
    return existing;
  }

  async function restoreOutfitRecommendations(db, requestId, rows) {
    const { error: deleteError } = await db.from("outfit_request_recommendations").delete().eq("request_id", requestId);
    if (deleteError) throw deleteError;
    if (!rows.length) return;
    const { error } = await db.from("outfit_request_recommendations").insert(rows.map((row) => ({ ...row, request_id: requestId })));
    if (error) throw error;
  }

  async function updateOutfitRequest(input) {
    const source = assertObject(input, "Update request outfit");
    if (!(await isAdmin())) throw new Error("Masuk sebagai admin COMOOTD untuk mengubah request outfit.");
    const requestId = assertUuid(source.id, "Request outfit");
    const db = getClient();
    const { data: existing, error: existingError } = await db
      .from("outfit_requests")
      .select("id, status, response_message, responded_at")
      .eq("id", requestId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new Error("Request outfit tidak ditemukan.");

    const statusInput = firstDefined(source, ["status"]);
    const status = statusInput.provided ? String(statusInput.value || "").trim().toLowerCase() : existing.status;
    if (!outfitRequestStatuses.has(status)) throw new Error("Status request belum valid.");
    const responseInput = firstDefined(source, ["responseMessage", "response_message"]);
    const responseMessage = status === "replied" || status === "closed"
      ? normalizeUserText(responseInput.provided ? responseInput.value : existing.response_message, "Jawaban untuk member", { required: true, min: 1, max: 3000 })
      : null;
    const recommendationsInput = firstDefined(source, ["recommendations"]);
    const recommendations = recommendationsInput.provided ? normalizeOutfitRecommendations(recommendationsInput.value || []) : null;
    if (recommendations) await assertPublishedOutfitRecommendationTargets(db, recommendations);

    let previousRecommendations = null;
    try {
      if (recommendations) previousRecommendations = await replaceOutfitRecommendations(db, requestId, recommendations);
      const responseWasUpdated = responseInput.provided || status !== existing.status;
      const respondedAt = responseMessage
        ? (responseWasUpdated || !existing.responded_at ? new Date().toISOString() : existing.responded_at)
        : null;
      const { error: updateError } = await db
        .from("outfit_requests")
        .update({ status, response_message: responseMessage, responded_at: respondedAt })
        .eq("id", requestId);
      if (updateError) throw updateError;

      const adminNoteInput = firstDefined(source, ["adminNote", "admin_note"]);
      if (adminNoteInput.provided) {
        const note = normalizeUserText(adminNoteInput.value, "Catatan internal", { max: 3000 });
        if (note) {
          const { error: noteError } = await db.from("outfit_request_admin_notes").upsert({ request_id: requestId, note }, { onConflict: "request_id" });
          if (noteError) throw noteError;
        } else {
          const { error: noteError } = await db.from("outfit_request_admin_notes").delete().eq("request_id", requestId);
          if (noteError) throw noteError;
        }
      }
    } catch (error) {
      if (previousRecommendations) {
        try {
          await restoreOutfitRecommendations(db, requestId, previousRecommendations);
        } catch (restoreError) {
          console.error("Rekomendasi request sebelumnya tidak dapat dipulihkan.", restoreError);
        }
      }
      throw error;
    }
    return { id: requestId, status };
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
    return (pieces.join("\n\n") || `${title} — COMOOTD Journal`).slice(0, 16000);
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

  function normalizeLookImportPayload(group) {
    const key = normalizeImportKey(group?.key);
    const title = String(group?.title || "").trim();
    const excerpt = String(group?.excerpt || "").trim();
    const coverImageUrl = assertImageUrl(group?.coverImageUrl);
    const coverAltText = String(group?.coverAltText || "").trim();
    const tone = String(group?.tone || "").trim().toLowerCase();
    const genderTarget = normalizeGenderTarget(group?.genderTarget);
    const styles = Array.isArray(group?.styles)
      ? [...new Set(group.styles.map((style) => String(style || "").trim()).filter(Boolean))].slice(0, 12)
      : [];
    const items = Array.isArray(group?.items) ? group.items.map((item) => ({
      productKey: normalizeImportKey(item?.productKey),
      variantLabel: String(item?.variantLabel || "").trim(),
      position: Number(item?.position)
    })) : [];

    if (!key) throw new Error("look_key wajib diisi.");
    if (!title || title.length > 160) throw new Error("Nama look wajib diisi dan maksimal 160 karakter.");
    if (excerpt.length > 500) throw new Error("Excerpt maksimal 500 karakter.");
    if (!styles.length) throw new Error("Look memerlukan minimal satu tag style.");
    if (!["carbon", "clay", "mineral", "olive", "midnight"].includes(tone)) throw new Error("tone belum sesuai pilihan COMOOTD.");
    if (coverImageUrl && !coverAltText) throw new Error("Deskripsi cover wajib diisi saat memakai cover_image_url.");
    if (coverAltText.length > 240) throw new Error("Deskripsi cover maksimal 240 karakter.");
    if (items.length < 2 || items.length > 5) throw new Error("Satu look harus berisi 2–5 item.");
    const sortedItems = [...items].sort((a, b) => a.position - b.position);
    const positions = sortedItems.map((item) => item.position);
    if (positions.some((position, index) => !Number.isInteger(position) || position !== index + 1)) {
      throw new Error("item_position harus berurutan dari 1 sampai jumlah item.");
    }
    const productVariants = new Set();
    sortedItems.forEach((item) => {
      if (!item.productKey || !item.variantLabel) throw new Error("product_key dan variant_label wajib diisi untuk setiap item.");
      const identifier = `${item.productKey}:${item.variantLabel.toLowerCase()}`;
      if (productVariants.has(identifier)) throw new Error("Satu varian produk tidak boleh dipakai dua kali pada look yang sama.");
      productVariants.add(identifier);
    });
    return { key, title, excerpt, coverImageUrl, coverAltText, tone, genderTarget, styles, items: sortedItems };
  }

  async function importLooks(groups, onProgress) {
    if (!Array.isArray(groups) || !groups.length) throw new Error("Belum ada look untuk diimpor.");
    const preparedGroups = groups.map(normalizeLookImportPayload);
    const lookKeys = preparedGroups.map((group) => group.key);
    if (new Set(lookKeys).size !== lookKeys.length) throw new Error("look_key tidak boleh diulang pada satu file.");

    const db = getClient();
    const productKeys = [...new Set(preparedGroups.flatMap((group) => group.items.map((item) => item.productKey)))];
    const [{ data: productRows, error: productError }, { data: existingLookRows, error: existingLookError }] = await Promise.all([
      db.from("products").select("id,import_key").in("import_key", productKeys),
      db.from("looks").select("id,import_key").in("import_key", lookKeys)
    ]);
    if (productError) throw productError;
    if (existingLookError) throw existingLookError;

    const productsByKey = new Map((productRows || []).map((product) => [String(product.import_key || "").toUpperCase(), product]));
    const productIds = (productRows || []).map((product) => product.id);
    const variantsByReference = new Map();
    if (productIds.length) {
      const { data: variantRows, error: variantError } = await db
        .from("product_variants")
        .select("id,product_id,label,is_active")
        .in("product_id", productIds)
        .eq("is_active", true);
      if (variantError) throw variantError;
      (variantRows || []).forEach((variant) => {
        const product = (productRows || []).find((candidate) => candidate.id === variant.product_id);
        const key = String(product?.import_key || "").toUpperCase();
        const reference = `${key}:${String(variant.label || "").trim().toLowerCase()}`;
        if (key && !variantsByReference.has(reference)) variantsByReference.set(reference, variant);
      });
    }

    const existingLookKeys = new Set((existingLookRows || []).map((look) => String(look.import_key || "").toUpperCase()));
    const results = [];
    for (let index = 0; index < preparedGroups.length; index += 1) {
      const group = preparedGroups[index];
      try {
        const variantIds = group.items.map((item) => {
          const product = productsByKey.get(item.productKey);
          if (!product) throw new Error(`Produk dengan product_key ${item.productKey} belum ditemukan. Import produk terlebih dahulu.`);
          const variant = variantsByReference.get(`${item.productKey}:${item.variantLabel.toLowerCase()}`);
          if (!variant) throw new Error(`Varian ${item.variantLabel} untuk ${item.productKey} belum ditemukan atau tidak aktif.`);
          return variant.id;
        });
        const { error } = await db.rpc("import_sisip_look", {
          p_look_key: group.key,
          p_title: group.title,
          p_excerpt: group.excerpt || null,
          p_cover_image_path: group.coverImageUrl || null,
          p_cover_alt_text: group.coverAltText || null,
          p_tone: group.tone,
          p_gender_target: group.genderTarget,
          p_style_tags: group.styles,
          p_product_variant_ids: variantIds
        });
        if (error) throw error;
        const item = { key: group.key, name: group.title, ok: true, created: !existingLookKeys.has(group.key) };
        results.push(item);
        if (typeof onProgress === "function") onProgress({ index: index + 1, total: preparedGroups.length, ...item });
      } catch (error) {
        const item = { key: group.key, name: group.title, ok: false, error: error?.message || "Look belum dapat diimpor." };
        results.push(item);
        if (typeof onProgress === "function") onProgress({ index: index + 1, total: preparedGroups.length, ...item });
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
    if (!sourceProducts.length || !sourceLooks.length) throw new Error("Data sample COMOOTD belum lengkap.");

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
    const slots = Array.isArray(lookIds) ? lookIds.map((id) => {
      const value = String(id || "").trim();
      return value || null;
    }) : [];
    const ids = slots.filter(Boolean);
    if (slots.length !== 5) {
      throw new Error("New Series memiliki lima slot.");
    }
    if (new Set(ids).size !== ids.length) {
      throw new Error("Satu look hanya boleh dipakai sekali di New Series.");
    }
    const { error } = await getClient().rpc("set_sisip_new_series", { p_look_ids: slots });
    if (error) throw error;
  }

  window.SISIPCloud = {
    isConfigured: validConfig,
    config,
    loadState,
    getSession,
    getCurrentUser,
    onAuthStateChange,
    isAdmin,
    signInAdmin,
    signInMember,
    signUpMember,
    resendMemberConfirmation,
    signOut,
    getMemberProfile,
    saveMemberProfile,
    createOutfitRequest,
    loadMyOutfitRequests,
    loadOutfitRequests,
    updateOutfitRequest,
    createProduct,
    importProducts,
    importLooks,
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
