import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.COMOOTD_PLAYWRIGHT || 'C:/Users/Albari Firdaus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const production=process.argv.includes('--production');
const live=production || process.argv.includes('--live');
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let name=extname(pathname)?pathname.slice(1):'index.html';
  if(!live && name==='assets/services/supabase.js') name='tools/qa-pagination-fixture.js';
  const target=resolve(root,name);
  if(!target.startsWith(root+sep)){res.writeHead(403).end();return;}
  try {
    const body=await readFile(target);
    res.writeHead(200,{'content-type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp'})[extname(target)]||'application/octet-stream','cache-control':'no-store'}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=production?'https://sisip-fashion.pages.dev':`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const context=await browser.newContext();
  await context.route('https://fonts.**',route=>route.abort());
  if(!live) await context.route('https://**',route=>route.abort());
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  if(live) page.on('console',msg=>{if(msg.type()==='warning'||msg.type()==='error') console.log(msg.type(),msg.text().slice(0,700));});
  // Live checks are read-only: prevent analytics or any other writes.
  if(live) await page.route('**/rest/v1/**',route=>{
    const req=route.request(),read=req.method()==='GET'||/\/rpc\/comootd_(directory_page|curator_summaries)$/.test(new URL(req.url()).pathname);
    return read?route.continue():route.fulfill({status:200,contentType:'application/json',body:'null'});
  });
  for(const width of [360,390,430,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for(const [path,selector,expected] of [['looks','.catalogue-look-card',24],['products','.catalogue-product-card',24],['curators','.curator-directory-card',12]]) {
      await page.goto(`${base}/${path}${live?'':'?page=2'}`);
      await page.locator(selector).first().waitFor({timeout:25000});
      console.log(`Checked ${path} at ${width}`);
      const count=await page.locator(selector).count();
      assert(live?count<=expected:count===expected,`${path}: ${count} expected ${expected}`);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} overflow at ${width}`);
    }
  }
  if(!live) {
    await page.goto(`${base}/looks?page=2`);
    await page.locator('.catalogue-look-card').first().waitFor();
    assert.match(await page.locator('.catalogue-look-title').first().textContent(),/Look 25/);
    await page.locator('a[rel=next]').click();
    await page.waitForFunction(()=>document.querySelector('.catalogue-look-title')?.textContent==='Look 49');
    await page.locator('[data-directory-filter=q]').fill('Look 80');
    await page.waitForFunction(()=>document.querySelector('.catalogue-look-title')?.textContent==='Look 80');
    assert.equal(await page.locator('.catalogue-look-card').count(),1);
    assert.match(page.url(),/page=1/);
    await page.goto(`${base}/products?page=999`);
    await page.waitForFunction(()=>document.querySelector('.catalogue-product-card h2')?.textContent==='Product 73');
    assert.equal(await page.locator('.catalogue-product-card').count(),8);
    await page.goto(`${base}/curators?page=4`);
    await page.locator('.curator-directory-card').first().waitFor();
    assert.equal(await page.locator('.curator-directory-card').count(),4);
    await page.locator('[data-curator-directory-filter=q]').fill('Curator 40');
    await page.waitForFunction(()=>document.querySelector('#curatorRouteLayer .curator-card-name')?.textContent==='Curator 40');
    assert.equal(await page.locator('.curator-directory-card').count(),1);
    await page.goto(`${base}/looks?page=2`);
    await page.locator('.catalogue-look-card').first().waitFor();
    await page.locator('.catalogue-look-image').nth(8).scrollIntoViewIfNeeded();
    await page.evaluate(()=>document.addEventListener('click',()=>{window.qaDepartureScroll=document.getElementById('catalogueRouteLayer').scrollTop;},{capture:true,once:true}));
    await page.locator('.catalogue-look-image').nth(8).click();
    const scroll=await page.evaluate(()=>window.qaDepartureScroll);
    await page.locator('#lookModal[open]').waitFor();
    await page.goBack();
    await page.locator('.catalogue-look-card').first().waitFor();
    assert.match(page.url(),/page=2/);
    assert.equal(await page.locator('.catalogue-look-title').first().textContent(),'Look 25');
    const restored=await page.locator('#catalogueRouteLayer').evaluate(el=>el.scrollTop);
    assert(Math.abs(restored-scroll)<5,`Return must restore scroll: ${scroll} -> ${restored}`);
    await page.locator('[data-directory-filter=q]').fill('slow');
    await page.locator('[data-directory-filter=q]').fill('Look 80');
    await page.waitForFunction(()=>document.querySelector('.catalogue-look-title')?.textContent==='Look 80');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.catalogue-look-title').first().textContent(),'Look 80');
    await page.locator('[data-directory-filter=q]').fill('error');
    await page.locator('[data-page-retry]').waitFor();
    await page.locator('[data-directory-filter=q]').fill('Look 80');
    await page.locator('.catalogue-look-card').first().waitFor();
  }
  await page.goto(`${base}/curators`);
  await page.locator('.curator-directory-card').first().waitFor();
  await page.locator('.curator-directory-card [data-curator-route]').first().focus();
  await page.keyboard.press('Enter');
  await page.locator('.curator-profile-title').waitFor().catch(async error=>{console.log('Profile failure',page.url(),await page.locator('#curatorRouteLayer').innerText(),errors);throw error;});
  await page.reload();
  await page.locator('.curator-profile-title').waitFor();
  await page.goto(`${base}/looks`);
  await page.locator('.catalogue-look-card').first().waitFor();
  await page.locator('.catalogue-look-image').first().click();
  await page.locator('#lookModal[open]').waitFor();
  const detailUrl=page.url();
  await page.goto(detailUrl);
  await page.locator('#lookModal[open]').waitFor({timeout:25000});
  assert.deepEqual(errors,[]);
  if(process.argv.includes('--screenshots')) {
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      await page.goto(`${base}/looks${live?'':'?page=2'}`);
      await page.locator('.catalogue-look-card').first().waitFor();
      await page.locator('#siteLoader').waitFor({state:'hidden'});
      if(!live) await page.locator('.directory-pagination').scrollIntoViewIfNeeded();
      const path=resolve(tmpdir(),`comootd-pagination-${live?'live':'fixture'}-${width}.png`);
      await page.screenshot({path});
      console.log(`Screenshot: ${path}`);
    }
  }
  console.log(`Pagination ${live?'LIVE read-only':'80-item fixture'} QA passed: page sizes, six widths, detail direct load${live?'':', Next, global search, out-of-range page, curator search'}.`);
} finally {await browser.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
