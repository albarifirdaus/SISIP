import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.COMOOTD_PLAYWRIGHT || 'C:/Users/Albari Firdaus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=fileURLToPath(new URL('..',import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<input type="file" id="campaignImage" accept="image/png,image/jpeg,image/webp"><input type="file" id="curatorAvatarInput" accept="image/png,image/jpeg,image/webp">');
  await page.addScriptTag({path:resolve(root,'assets/components/image-optimizer.js')});
  const result=await page.evaluate(async()=>{
    const api=window.COMOOTDImageOptimizer;
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=3200;
    const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,2400,3200);
    gradient.addColorStop(0,'#665e53');gradient.addColorStop(1,'#f1dfb2');ctx.fillStyle=gradient;ctx.fillRect(0,0,2400,3200);
    ctx.fillStyle='#111';ctx.font='80px sans-serif';ctx.fillText('Fabric detail 123',150,180);
    for(let x=0;x<2400;x+=14){ctx.fillStyle=x%28?'#888':'#bbb';ctx.fillRect(x,400,3,2400);}
    const toFile=(canvas,type)=>new Promise(resolve=>canvas.toBlob(blob=>resolve(new File([blob],'source.'+(type==='image/png'?'png':'jpg'),{type:blob.type})),type,.96));
    const source=await toFile(canvas,'image/jpeg');
    const full=await api.prepare(source,'photo');
    check(full.width===1200&&full.height===1600,'Photo dimensions');
    check(full.thumbWidth===480&&full.thumbnail,'Thumbnail dimensions');
    check(full.detail.size<source.size,'Photo should shrink');
    check(await api.prepare(full.detail,'photo')===full,'Prepared file must not be encoded twice');
    const avatar=await api.prepare(source,'avatar');check(avatar.height===400&&!avatar.thumbnail,'Avatar bounded');
    const banner=await api.prepare(source,'banner');check(banner.height===1920,'Banner bounded');
    const transparent=document.createElement('canvas');transparent.width=240;transparent.height=180;
    transparent.getContext('2d').fillRect(60,60,60,60);
    const png=await toFile(transparent,'image/png'),small=await api.prepare(png,'photo');
    check(small.width===240&&small.height===180&&!small.thumbnail,'No upscale');
    check(small.detail.type==='image/png'&&small.detail.size<=png.size,'Lossless PNG without size inflation');
    const decoded=await createImageBitmap(small.detail);const pixels=document.createElement('canvas');pixels.width=240;pixels.height=180;
    pixels.getContext('2d').drawImage(decoded,0,0);check(pixels.getContext('2d').getImageData(0,0,1,1).data[3]===0,'Alpha must remain transparent');decoded.close();
    const calls=[],storage={upload:async(path,blob,options)=>{calls.push({path,type:blob.type,options});return{};},remove:async paths=>{calls.push({removed:paths});return{};}};
    const path=await api.upload(storage,'looks/test/portrait-example',source);
    check(calls.length===2&&calls[0].path.includes('-thumb.')&&calls[1].path===path,'Upload both variants');
    check(calls.every(c=>c.options.upsert===false&&c.options.contentType===c.type),'Safe upload options');
    check(api.paths([path]).length===2&&api.paths(['old/file.jpg']).length===1,'Scoped variant cleanup');
    check(api.attributes(path).includes('480w')&&api.attributes(path).includes('1200w'),'Responsive attributes');
    check(api.attributes('old/file.jpg')==='','Old content untouched');
    const removed=[];let count=0;
    await api.upload({upload:async()=>++count===2?{error:Error('QA failure')}:{},remove:async paths=>{removed.push(...paths);return{};}},'looks/test/failed',source).then(()=>{throw Error('Failure was swallowed');},()=>{});
    check(removed.length===1&&removed[0].includes('-thumb.'),'Failed main upload removes only its uploaded thumbnail');
    let rejected=false;try{await api.prepare(new File(['not a png'],'bad.png',{type:'image/png'}));}catch{rejected=true;}check(rejected,'Invalid bytes rejected');
    const input=document.getElementById('campaignImage'),transfer=new DataTransfer();transfer.items.add(source);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,300));
    check(document.querySelector('.image-optimization-preview summary')?.textContent.includes('Preview hasil'),'Raw upload preview');
    return {source:source.size,detail:full.detail.size,thumbnail:full.thumbnail.size,avatar:avatar.detail.size,path};
  });
  assert.deepEqual(errors,[]);
  await page.addScriptTag({path:resolve(root,'assets/components/image-cropper.js')});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{
    const input=document.getElementById('curatorAvatarInput');window.COMOOTDImageCropper.bind(input,{allowedAspects:['square']});
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=800;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#ffc629';ctx.fillRect(250,250,300,300);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const transfer=new DataTransfer();transfer.items.add(new File([blob],'transparent.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.getByRole('button',{name:'Gunakan foto',exact:true}).click();
  await page.waitForFunction(()=>window.COMOOTDImageCropper.getFile(document.getElementById('curatorAvatarInput')));
  const crop=await page.evaluate(async()=>{
    const file=window.COMOOTDImageCropper.getFile(document.getElementById('curatorAvatarInput'));
    const prepared=await window.COMOOTDImageOptimizer.prepare(file,'avatar');
    const image=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    canvas.getContext('2d').drawImage(image,0,0);const alpha=canvas.getContext('2d').getImageData(0,0,1,1).data[3];image.close();
    return {width:prepared.width,height:prepared.height,alpha,type:file.type,summary:window.COMOOTDImageOptimizer.summary(file)};
  });
  assert.equal(crop.width,400);assert.equal(crop.height,400);assert.equal(crop.alpha,0);assert.equal(crop.type,'image/png');
  assert.deepEqual(errors,[]);
  await page.addStyleTag({path:resolve(root,'assets/components/image-optimizer.css')});
  await page.locator('.image-optimization-preview').evaluate(node=>{node.open=true;});
  await page.screenshot({path:resolve(tmpdir(),'comootd-image-upload-preview.png'),fullPage:true});
  console.log('Image optimizer QA passed',result);
  console.log('Cropper integration passed',crop);
  const sampleIndex=process.argv.indexOf('--sample');
  if(sampleIndex>=0) {
    const data=(await readFile(resolve(process.argv[sampleIndex+1]))).toString('base64');
    const comparison=await page.evaluate(async base64=>{
      const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);
      const source=await new Promise(resolve=>canvas.toBlob(blob=>resolve(new File([blob],'fashion.jpg',{type:'image/jpeg'})),'image/jpeg',.96));
      const result=await window.COMOOTDImageOptimizer.prepare(source);
      document.body.replaceChildren();document.body.style.cssText='font:16px sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#eee';
      for(const [title,blob] of [['Sumber JPG',source],['Hasil WebP',result.detail]]) {
        const section=document.createElement('section'),heading=document.createElement('p'),img=document.createElement('img');
        heading.textContent=`${title}: ${Math.round(blob.size/1024)} KB`;img.src=URL.createObjectURL(blob);img.style.width='100%';section.append(heading,img);document.body.append(section);await img.decode();
      }
      return {source:source.size,detail:result.detail.size,thumbnail:result.thumbnail?.size,width:result.width,height:result.height};
    },data);
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:resolve(tmpdir(),'comootd-fashion-compression-comparison.png'),fullPage:true});
    console.log('Fashion sample comparison',comparison);
  }
} finally {await browser.close();}
