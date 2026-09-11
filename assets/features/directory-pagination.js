(() => {
  "use strict";
  function create(win) {
  const page = () => Math.max(1, Math.min(2147483647, Math.trunc(Number(new URL(win.location.href).searchParams.get("page"))) || 1));
  function url(number) {
    const target = new URL(win.location.href);
    target.searchParams.set("page", String(number));
    return target.pathname + target.search;
  }
  function markup(current, total, size) {
    const pages = Math.max(1, Math.ceil(total / size));
    if (pages < 2) return "";
    const link = (n, label, extra = "") => `<a href="${url(n).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}" data-directory-page="${n}" ${extra}>${label}</a>`;
    const numbers = [...new Set([1, current - 1, current, current + 1, pages])].filter(n => n > 0 && n <= pages).sort((a,b)=>a-b);
    return `<nav class="directory-pagination" aria-label="Halaman katalog">${current > 1 ? link(current - 1, "← Previous", 'rel="prev"') : '<span aria-disabled="true">← Previous</span>'}<div>${numbers.map((n,i) => `${i && n > numbers[i-1]+1 ? '<span aria-hidden="true">…</span>' : ''}${link(n,n,n===current?'aria-current="page"':'')}`).join("")}</div>${current < pages ? link(current + 1, "Next →", 'rel="next"') : '<span aria-disabled="true">Next →</span>'}</nav>`;
  }
  function writeFilters(filters, defaults) {
    const target = new URL(win.location.href);
    Object.entries(filters).forEach(([key,value]) => value && value !== defaults[key] ? target.searchParams.set(key,value) : target.searchParams.delete(key));
    target.searchParams.set("page","1");
    win.history.replaceState(win.history.state,"",target.pathname+target.search);
  }
  function readFilters(defaults) {
    const params = new URL(win.location.href).searchParams;
    return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,params.get(key) ?? value]));
  }
  function canonical() {
    const current=new URL(win.location.href), clean=new URL(current.pathname,current.origin);
    for(const name of ["q","gender","style","sort","category","price","marketplace","tag"]) {
      const value=current.searchParams.get(name);
      if(value && value!=="all" && !(name==="sort" && value==="popular")) clean.searchParams.set(name,value.slice(0,200));
    }
    if(page()>1) clean.searchParams.set("page",String(page()));
    return clean.href;
  }
  return { page, markup, writeFilters, readFilters, url, canonical };
  }
  window.COMOOTDPagination = Object.freeze({ ...create(window), create });
})();
