(() => {
  "use strict";

  function create({ safeImage, esc, tones: TONES, lookAttribution }) {
    function productArt(productItem, variant, small = false) {
      const img = safeImage(variant?.image || productItem?.image);
      const frame = "image-frame--square";
      if (img) return `<div class="product-art ${frame} ${small ? "is-small" : ""}"><img src="${esc(img)}" alt="${esc(`${productItem?.name || "Produk"} ${variant?.name || ""}`.trim())}" /></div>`;
      const bg = variant?.hex ? blendHex(variant.hex, "#e7e1da", .55) : productItem?.artBg || "#d5ccc3";
      const ink = variant?.hex || productItem?.artInk || "#242220";
      return `<div class="product-art ${frame} ${small ? "is-small" : ""}" style="--product-bg:${esc(bg)};--product-ink:${esc(ink)}"><span class="product-code meta">${esc(productItem?.category || "COMOOTD")}</span><span class="garment"></span></div>`;
    }
    function blendHex(a, b, weight) {
      const toRgb = (hex) => { const raw = hex.replace("#", ""); const full = raw.length === 3 ? raw.split("").map((c) => c+c).join("") : raw; return [0,2,4].map((i) => parseInt(full.slice(i,i+2),16)); };
      try { const x=toRgb(a), y=toRgb(b); const rgb=x.map((n,i)=>Math.round(n*(1-weight)+y[i]*weight)); return `#${rgb.map((n)=>n.toString(16).padStart(2,"0")).join("")}`; } catch { return "#d5ccc3"; }
    }
    function lookMediaEntries(lookItem) {
      const values=Array.isArray(lookItem?.media) ? lookItem.media : [];
      const sources=values.length ? values : [{image:lookItem?.coverImage,alt:lookItem?.coverAlt || ""}];
      const seen=new Set();
      return sources.map((entry)=>({ image:safeImage(entry?.image || entry?.url || entry?.path), alt:String(entry?.alt || entry?.altText || "").trim() })).filter((entry)=>{
        if(!entry.image || seen.has(entry.image)) return false;
        seen.add(entry.image); return true;
      }).slice(0,3);
    }
    function lookVisual(lookItem, detail = false) {
      const media=lookMediaEntries(lookItem);
      if (media.length) {
        const primary=media[0];
        const support=media.slice(1).map((entry)=>`<img src="${esc(entry.image)}" alt="${esc(entry.alt || `Foto look ${lookItem.title}`)}" loading="lazy" />`).join("");
        return `<div class="look-media-collage" data-count="${media.length}" aria-label="${esc(`Galeri ${lookItem.title || "look"}`)}"><img class="look-media-collage__primary" src="${esc(primary.image)}" alt="${esc(primary.alt || `Foto look ${lookItem.title}`)}" />${support ? `<span class="look-media-collage__support">${support}</span>` : ""}</div>`;
      }
      const tone = TONES[lookItem.tone] || TONES.carbon;
      return `<div class="look-art ${lookItem.createdOrder % 2 === 0 ? "flip" : ""} ${tone.light ? "light" : ""}" style="--art-bg:${tone.bg};--art-accent:${tone.accent};--garment:${tone.garment};--bottom:${tone.bottom};--figure:${tone.figure};--skin:${tone.skin};--skin-dark:${tone.skinDark};--hair:${tone.hair};--art-label:${tone.label};">
        <span class="art-index meta">COMOOTD LOOK</span><span class="stripe"></span>
        <div class="figure secondary" aria-hidden="true"><span class="hair"></span><span class="head"></span><span class="neck"></span><span class="body"></span><span class="arm left"></span><span class="arm right"></span><span class="leg left"></span><span class="leg right"></span></div>
        <div class="figure" aria-hidden="true"><span class="hair"></span><span class="head"></span><span class="neck"></span><span class="body"></span><span class="arm left"></span><span class="arm right"></span><span class="leg left"></span><span class="leg right"></span></div>
        <span class="art-caption meta">${esc(lookAttribution(lookItem))}</span>
      </div>`;
    }

    return Object.freeze({ productArt, blendHex, lookMediaEntries, lookVisual });
  }

  window.COMOOTDCatalogMedia = Object.freeze({ create });
})();
