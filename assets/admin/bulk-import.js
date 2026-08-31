(() => {
  "use strict";

  function create(dependencies = {}) {
    const { STYLE_ORDER, PRODUCT_BADGE_OPTIONS, MARKETPLACES, PRODUCT_CATEGORIES, BULK_IMPORT_MAX_ROWS, BULK_IMPORT_MAX_PRODUCTS, BULK_LOOK_IMPORT_MAX_ROWS, BULK_LOOK_IMPORT_MAX_LOOKS, marketplaceFromUrl, affiliateUrl } = dependencies;

    function parseTags(value) { return String(value).split(",").map((tag)=>tag.trim()).filter(Boolean).slice(0,6); }
    function normalizeBulkHeader(value) { return String(value || "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_"); }
    function parseCsvMatrix(text) {
      const source = String(text || "");
      const firstLine = source.split(/\r?\n/, 1)[0] || "";
      const commaCount = (firstLine.match(/,/g) || []).length;
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ";" : ",";
      const rows = [];
      let row = [];
      let value = "";
      let quoted = false;
      for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (quoted) {
          if (character === '"') {
            if (source[index + 1] === '"') { value += '"'; index += 1; }
            else quoted = false;
          } else value += character;
          continue;
        }
        if (character === '"') { quoted = true; continue; }
        if (character === delimiter) { row.push(value); value = ""; continue; }
        if (character === "\n") { row.push(value); rows.push(row); row = []; value = ""; continue; }
        if (character !== "\r") value += character;
      }
      if (quoted) throw new Error("CSV memiliki tanda petik yang belum ditutup.");
      if (value || row.length) { row.push(value); rows.push(row); }
      return rows;
    }
    function matrixToImportRows(matrix, required) {
      const meaningfulRows = (matrix || []).filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim()));
      if (!meaningfulRows.length) throw new Error("File belum memiliki isi.");
      const headers = meaningfulRows[0].map(normalizeBulkHeader);
      const nonEmptyHeaders = headers.filter(Boolean);
      if (new Set(nonEmptyHeaders).size !== nonEmptyHeaders.length) throw new Error("Nama kolom pada file tidak boleh duplikat.");
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error("Kolom wajib belum ditemukan: " + missing.join(", ") + ".");
      return meaningfulRows.slice(1).map((cells, index) => {
        const row = { rowNumber: index + 2 };
        headers.forEach((header, column) => { if (header) row[header] = String(cells[column] ?? "").trim(); });
        return row;
      });
    }
    function matrixToBulkRows(matrix) { return matrixToImportRows(matrix, ["product_key", "name", "affiliate_url", "price_idr", "color_name"]); }
    function matrixToBulkLookRows(matrix) { return matrixToImportRows(matrix, ["look_key", "title", "gender_target", "item_position", "product_key", "variant_label"]); }
    function normalizeBulkImageUrl(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:") throw new Error("URL foto harus memakai https://.");
      return parsed.href;
    }
    function normalizeBulkColorHex(value) {
      let hex = String(value || "").trim();
      if (!hex) return "";
      if (/^#[0-9a-f]{3}$/i.test(hex)) hex = "#" + hex.slice(1).split("").map((part) => part + part).join("");
      if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("color_hex harus memakai format #RRGGBB.");
      return hex.toUpperCase();
    }
    function normalizeBulkGender(value) {
      const gender = String(value || "unisex").trim().toLowerCase();
      if (!gender || gender === "unisex" || gender === "uniseks") return "unisex";
      if (gender === "pria" || gender === "wanita") return gender;
      throw new Error("gender_target harus pria, wanita, atau unisex.");
    }
    function parseBulkPrice(value) {
      const digits = String(value || "").replace(/[^0-9]/g, "");
      const price = Number(digits);
      if (!Number.isSafeInteger(price) || price <= 0) throw new Error("price_idr harus berupa harga IDR lebih dari nol.");
      return price;
    }
    const BULK_STYLE_TAGS = new Map([
      ...STYLE_ORDER.map((style) => [style.toLowerCase(), style]),
      ["korea style", "Korean-inspired"], ["korean style", "Korean-inspired"], ["korean inspired", "Korean-inspired"]
    ]);
    const BULK_PRODUCT_BADGES = new Map([
      ...PRODUCT_BADGE_OPTIONS.slice(1).map((badge) => [badge.toLowerCase(), badge]),
      ["populer", "High Rotation"], ["best seller", "High Rotation"], ["terlaris", "High Rotation"], ["termurah", "Best Value"]
    ]);
    function parseBulkTags(row) {
      const values = [row.style_tags, row.style_tag_1, row.style_tag_2, row.style_tag_3]
        .flatMap((value) => String(value || "").split(/[|,;]/))
        .map((tag) => tag.trim())
        .filter(Boolean);
      const invalid = values.filter((tag) => !BULK_STYLE_TAGS.has(tag.toLowerCase()));
      if (invalid.length) throw new Error("Tag style tidak sesuai pilihan COMOOTD: " + [...new Set(invalid)].join(", ") + ".");
      const tags = [...new Set(values.map((tag) => BULK_STYLE_TAGS.get(tag.toLowerCase())))];
      if (tags.length > 3) throw new Error("Tag style maksimal 3 pilihan.");
      return tags;
    }
    function parseBulkBadge(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const badge = BULK_PRODUCT_BADGES.get(raw.toLowerCase());
      if (!badge) throw new Error("Badge harus dipilih dari: " + PRODUCT_BADGE_OPTIONS.slice(1).join(", ") + ".");
      return badge;
    }
    function validateBulkRows(rows) {
      const errors = [];
      const warnings = [];
      const groups = new Map();
      if (!rows.length) errors.push("File tidak memiliki baris produk.");
      if (rows.length > BULK_IMPORT_MAX_ROWS) errors.push("Maksimal " + BULK_IMPORT_MAX_ROWS + " baris warna dalam satu import.");
      rows.slice(0, BULK_IMPORT_MAX_ROWS).forEach((row) => {
        const problems = [];
        const key = String(row.product_key || "").trim().toUpperCase();
        const name = String(row.name || "").trim();
        const colorName = String(row.color_name || "").trim();
        if (!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(key)) problems.push("product_key tidak valid.");
        if (!name) problems.push("name wajib diisi.");
        if (!colorName) problems.push("color_name wajib diisi.");
        let affiliateUrl = "";
        let affiliatePlatform = "shopee";
        let price = 0;
        let genderTarget = "unisex";
        let category = "other";
        let colorHex = "#B8AEA1";
        let coverImageUrl = "";
        let variantImageUrl = "";
        let styles = [];
        let badge = "";
        try {
          affiliatePlatform = String(row.marketplace || "").trim().toLowerCase() || marketplaceFromUrl(row.affiliate_url);
          if (!MARKETPLACES[affiliatePlatform]) throw new Error("marketplace harus shopee atau tiktok_shop.");
          affiliateUrl = affiliateUrlFromBulk(row.affiliate_url, affiliatePlatform);
        } catch (error) { problems.push(error.message); }
        try { price = parseBulkPrice(row.price_idr); } catch (error) { problems.push(error.message); }
        try { genderTarget = normalizeBulkGender(row.gender_target); } catch (error) { problems.push(error.message); }
        category=String(row.category||"other").trim().toLowerCase();
        if(!Object.prototype.hasOwnProperty.call(PRODUCT_CATEGORIES,category)) problems.push("category tidak sesuai pilihan template.");
        try { styles = parseBulkTags(row); } catch (error) { problems.push(error.message); }
        try { badge = parseBulkBadge(row.badge); } catch (error) { problems.push(error.message); }
        try { colorHex = normalizeBulkColorHex(row.color_hex) || "#B8AEA1"; if (!String(row.color_hex || "").trim()) warnings.push("Baris " + row.rowNumber + ": color_hex kosong, memakai #B8AEA1."); } catch (error) { problems.push(error.message); }
        try { coverImageUrl = normalizeBulkImageUrl(row.cover_image_url); } catch (error) { problems.push("cover_image_url: " + error.message); }
        try { variantImageUrl = normalizeBulkImageUrl(row.variant_image_url); } catch (error) { problems.push("variant_image_url: " + error.message); }
        if (problems.length) { errors.push("Baris " + row.rowNumber + ": " + problems.join(" ")); return; }
        const candidate = {
          key,
          name,
          affiliateUrl,
          affiliatePlatform,
          price,
          badge,
          styles,
          genderTarget,
          category,
          coverImageUrl,
          variants: [{ name: colorName, hex: colorHex, imageUrl: variantImageUrl }],
          variantNames: new Set([colorName.toLowerCase()])
        };
        const existing = groups.get(key);
        if (!existing) {
          if (groups.size >= BULK_IMPORT_MAX_PRODUCTS) { errors.push("Maksimal " + BULK_IMPORT_MAX_PRODUCTS + " produk dalam satu import."); return; }
          groups.set(key, candidate);
          return;
        }
        const sameMetadata = existing.name === candidate.name && existing.affiliateUrl === candidate.affiliateUrl && existing.affiliatePlatform === candidate.affiliatePlatform && existing.price === candidate.price && existing.badge === candidate.badge && existing.styles.join("|") === candidate.styles.join("|") && existing.genderTarget === candidate.genderTarget && existing.category === candidate.category && existing.coverImageUrl === candidate.coverImageUrl;
        if (!sameMetadata) { errors.push("Baris " + row.rowNumber + ": data produk untuk product_key " + key + " harus sama di setiap warna."); return; }
        if (existing.variantNames.has(colorName.toLowerCase())) { errors.push("Baris " + row.rowNumber + ": warna " + colorName + " tercatat dua kali untuk " + key + "."); return; }
        existing.variantNames.add(colorName.toLowerCase());
        existing.variants.push(candidate.variants[0]);
      });
      return {
        groups: Array.from(groups.values()).map((group) => ({ key: group.key, name: group.name, affiliateUrl: group.affiliateUrl, affiliatePlatform: group.affiliatePlatform, price: group.price, badge: group.badge, styles: group.styles, genderTarget: group.genderTarget, category: group.category, coverImageUrl: group.coverImageUrl, variants: group.variants })),
        errors,
        warnings
      };
    }
    function validateBulkLookRows(rows) {
      const errors = [];
      const warnings = [];
      const groups = new Map();
      if (!rows.length) errors.push("File tidak memiliki baris look.");
      if (rows.length > BULK_LOOK_IMPORT_MAX_ROWS) errors.push("Maksimal " + BULK_LOOK_IMPORT_MAX_ROWS + " baris item dalam satu import.");
      rows.slice(0, BULK_LOOK_IMPORT_MAX_ROWS).forEach((row) => {
        const problems = [];
        const key = String(row.look_key || "").trim().toUpperCase();
        const title = String(row.title || "").trim();
        const excerpt = String(row.excerpt || "").trim();
        const variantLabel = String(row.variant_label || "").trim();
        const productKey = String(row.product_key || "").trim().toUpperCase();
        const itemPosition = Number(String(row.item_position || "").trim());
        if (!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(key)) problems.push("look_key tidak valid.");
        if (!title || title.length > 160) problems.push("title wajib diisi dan maksimal 160 karakter.");
        if (excerpt.length > 500) problems.push("excerpt maksimal 500 karakter.");
        if (!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(productKey)) problems.push("product_key tidak valid.");
        if (!variantLabel || variantLabel.length > 80) problems.push("variant_label wajib diisi dan maksimal 80 karakter.");
        if (!Number.isInteger(itemPosition) || itemPosition < 1 || itemPosition > 5) problems.push("item_position harus angka 1 sampai 5.");
        let genderTarget = "unisex";
        let styles = [];
        let coverImageUrl = "";
        const coverAltText = String(row.cover_alt_text || "").trim();
        try { genderTarget = normalizeBulkGender(row.gender_target); } catch (error) { problems.push(error.message); }
        try { styles = parseBulkTags(row); if (!styles.length) problems.push("minimal satu style_tag wajib diisi."); } catch (error) { problems.push(error.message); }
        try { coverImageUrl = normalizeBulkImageUrl(row.cover_image_url); } catch (error) { problems.push("cover_image_url: " + error.message); }
        if (coverImageUrl && !coverAltText) problems.push("cover_alt_text wajib diisi saat cover_image_url dipakai.");
        if (coverAltText.length > 240) problems.push("cover_alt_text maksimal 240 karakter.");
        if (problems.length) { errors.push("Baris " + row.rowNumber + ": " + problems.join(" ")); return; }
        const candidate = {
          key,
          title,
          excerpt,
          genderTarget,
          styles,
          coverImageUrl,
          coverAltText,
          items: [{ productKey, variantLabel, position: itemPosition }],
          positions: new Set([itemPosition]),
          variants: new Set([productKey + ":" + variantLabel.toLowerCase()])
        };
        const existing = groups.get(key);
        if (!existing) {
          if (groups.size >= BULK_LOOK_IMPORT_MAX_LOOKS) { errors.push("Maksimal " + BULK_LOOK_IMPORT_MAX_LOOKS + " look dalam satu import."); return; }
          groups.set(key, candidate);
          return;
        }
        const sameMetadata = existing.title === candidate.title && existing.excerpt === candidate.excerpt && existing.genderTarget === candidate.genderTarget && existing.styles.join("|") === candidate.styles.join("|") && existing.coverImageUrl === candidate.coverImageUrl && existing.coverAltText === candidate.coverAltText;
        if (!sameMetadata) { errors.push("Baris " + row.rowNumber + ": metadata untuk look_key " + key + " harus sama pada setiap item."); return; }
        if (existing.positions.has(itemPosition)) { errors.push("Baris " + row.rowNumber + ": item_position " + itemPosition + " tercatat dua kali untuk " + key + "."); return; }
        const variantReference = productKey + ":" + variantLabel.toLowerCase();
        if (existing.variants.has(variantReference)) { errors.push("Baris " + row.rowNumber + ": varian " + variantLabel + " tercatat dua kali untuk " + key + "."); return; }
        existing.positions.add(itemPosition);
        existing.variants.add(variantReference);
        existing.items.push(candidate.items[0]);
      });
      const normalizedGroups = [];
      groups.forEach((group) => {
        const items = group.items.sort((left, right) => left.position - right.position);
        const positions = items.map((item) => item.position);
        if (items.length < 2 || items.length > 5) { errors.push("look_key " + group.key + " harus memiliki 2–5 item."); return; }
        if (positions.some((position, index) => position !== index + 1)) { errors.push("look_key " + group.key + " harus memakai item_position berurutan mulai dari 1."); return; }
        normalizedGroups.push({ key: group.key, title: group.title, excerpt: group.excerpt, genderTarget: group.genderTarget, styles: group.styles, coverImageUrl: group.coverImageUrl, coverAltText: group.coverAltText, items });
      });
      if (!normalizedGroups.length && groups.size && !errors.length) warnings.push("Tidak ada look yang siap diimpor.");
      return { groups: normalizedGroups, errors, warnings };
    }
    function affiliateUrlFromBulk(value, marketplace = "") { return affiliateUrl(value, marketplace); }
    async function readBulkMatrix(file, expectedSheet) {
      const extension = String(file?.name || "").split(".").pop().toLowerCase();
      if (extension === "csv" || file?.type === "text/csv") return parseCsvMatrix(await file.text());
      if (extension === "xlsx" || extension === "xls") {
        if (!window.XLSX || typeof window.XLSX.read !== "function") throw new Error("Parser Excel belum dimuat. Muat ulang halaman atau gunakan CSV.");
        const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
        const sheetName = workbook.SheetNames.find((name) => normalizeBulkHeader(name) === normalizeBulkHeader(expectedSheet)) || workbook.SheetNames[0];
        if (!sheetName) throw new Error("Sheet Excel tidak ditemukan.");
        return window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
      }
      throw new Error("Gunakan file CSV, XLSX, atau XLS.");
    }

    return Object.freeze({ parseTags, normalizeBulkHeader, parseCsvMatrix, matrixToImportRows, matrixToBulkRows, matrixToBulkLookRows, normalizeBulkImageUrl, normalizeBulkColorHex, normalizeBulkGender, parseBulkPrice, parseBulkTags, parseBulkBadge, validateBulkRows, validateBulkLookRows, affiliateUrlFromBulk, readBulkMatrix });
  }

  window.COMOOTDBulkImport = Object.freeze({ create });
})();
