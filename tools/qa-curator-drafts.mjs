import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Deterministic IndexedDB transaction double; no browser or production account writes.
const records = new Map();
let fail = false;
const db = { transaction() {
  const tx = { objectStore:() => ({
    put(value) { return request(() => { records.set(value.key, structuredClone(value)); return value.key; }); },
    getAll() { return request(() => structuredClone([...records.values()])); },
    delete(key) { return request(() => records.delete(key)); },
  }) };
  function request(action) {
    const req = {};
    setTimeout(() => {
      if (fail) { tx.error = new Error('QuotaExceededError'); tx.onabort(); }
      else { req.result = action(); tx.oncomplete(); }
    }, 2);
    return req;
  }
  return tx;
} };
const window = { addEventListener() {}, confirm:() => false };
const document = { addEventListener() {} };
const indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess(); }); return request; } };
runInNewContext(readFileSync(new URL('../assets/features/curator-drafts.js', import.meta.url), 'utf8'), { window, document, indexedDB, setTimeout, clearTimeout, crypto:globalThis.crypto });
const api = window.COMOOTDLookDrafts;
function form(owner, key) {
  const status = {textContent:''};
  const title = {name:'title',value:'Olive look',type:'text'};
  const photo = {name:'coverFile',files:[new File(['photo'], 'cover.png', {type:'image/png'})]};
  const result = {
    dataset:{currentStep:'2'}, elements:{title},
    querySelector:() => status,
    querySelectorAll(selector) {
      if (selector === '[data-curator-gallery-input]') return [photo];
      if (selector === '[data-curator-reference-row]') return [{},{}];
      return [title];
    },
    _draftSession:{owner,key,revision:1,dirty:true,queue:Promise.resolve(),options:{base:{items:[{},{}]},getFile:input=>input.files[0],getAspect:()=> 'square'}},
  };
  return result;
}
const a = form('account-a','account-a:1');
assert.equal(await api.save(a), true);
assert.equal(a._draftSession.dirty, false);
const saved = (await api.list('account-a'))[0];
assert.equal(saved.title, 'Olive look');
assert.equal(saved.photos[0].file.size, 5);
assert.equal(saved.photos[0].aspect, 'square');
assert.equal(saved.photos[0].ready, true);
assert.equal((await api.list('account-b')).length, 0, 'Other accounts must not see drafts');
const b = form('account-b','account-b:1');
b._draftSession.options.getFile = () => { throw new Error('crop pending'); };
await api.save(b);
assert.equal((await api.list('account-b'))[0].photos[0].ready, false);
assert.equal((await api.list('account-b'))[0].photos[0].file.size, 5, 'Uncropped raw photo must survive');
fail = true;
a._draftSession.dirty = true;
assert.equal(await api.save(a), false);
assert.equal(a._draftSession.dirty, true, 'Storage failure must never display saved state');
assert.equal(await api.leave(a), false, 'Failed save should keep editor open unless user confirms');
fail = false;
const saving = api.save(a);
a._draftSession.revision++;
assert.equal(await saving, false, 'An older save cannot clear newer unsaved edits');
await api.save(a);
await api.finish(a);
assert.equal((await api.list('account-a')).length, 0);
assert.equal((await api.list('account-b')).length, 1, 'Publishing only clears the matching draft');
console.log('Draft QA passed: account isolation, text/photo persistence, pending crop, failed storage, leave guard, stale-save guard, scoped cleanup.');
