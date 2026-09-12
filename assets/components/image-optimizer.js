(() => {
  "use strict";
  const presets={photo:{edge:1600,target:450*1024},avatar:{edge:400,target:80*1024},banner:{edge:1920,target:650*1024}};
  const prepared=new WeakMap(), pending=new WeakMap(), validated=new WeakSet();
  const marker=/-opt1-w(\d+)-t(\d+)\.(webp|png|jpg)(?=$|[?#])/;
  const bytes=n=>n<1024*1024?`${Math.round(n/1024)} KB`:`${(n/1024/1024).toFixed(2)} MB`;
  function presetForInput(input) {
    const name=`${input?.id || ''} ${input?.name || ''}`;
    return /avatar/i.test(name)?'avatar':/campaign|storefront|banner/i.test(name)||input?.hasAttribute('data-storefront-file')?'banner':'photo';
  }
  function validate(file) {
    if(!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw Error('Gunakan gambar JPG, PNG, atau WebP.');
    if(file.size>5*1024*1024) throw Error('Ukuran file sumber maksimal 5 MB.');
  }
  async function validateSource(file) {
    if(validated.has(file))return;
    validate(file);
    const data=new Uint8Array(await file.arrayBuffer()),view=new DataView(data.buffer);
    const tag=offset=>String.fromCharCode(...data.slice(offset,offset+4));
    const png=data[0]===137&&tag(1)==='PNG\r';
    const jpeg=data[0]===255&&data[1]===216&&data[2]===255;
    const webp=tag(0)==='RIFF'&&tag(8)==='WEBP';
    if(!(file.type==='image/png'&&png||file.type==='image/jpeg'&&jpeg||file.type==='image/webp'&&webp))throw Error('Isi file tidak sesuai format gambar. Gunakan JPG, PNG, atau WebP yang valid.');
    if(webp)for(let offset=12;offset+8<=data.length;){const name=tag(offset),size=view.getUint32(offset+4,true);if(name==='ANIM'||name==='ANMF')throw Error('Gunakan gambar statis; WebP animasi tidak dikompres agar gerakannya tidak hilang.');offset+=8+size+(size%2);}
    if(png)for(let offset=8;offset+12<=data.length;){if(tag(offset+4)==='acTL')throw Error('Gunakan PNG statis; gambar animasi tidak dikompres.');offset+=12+view.getUint32(offset);}
    validated.add(file);
  }
  const encode=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Gambar belum berhasil diproses.')),type,quality));
  function canvasFor(source,width,height) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    if(!ctx) throw Error('Browser belum mendukung pemrosesan gambar.');
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,width,height);
    return canvas;
  }
  function hasAlpha(canvas) {
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    for(let i=3;i<data.length;i+=4) if(data[i]<255) return true;
    return false;
  }
  async function fromCanvas(source,original,preset='photo',allowOriginal=false) {
    await validateSource(original);
    const settings=presets[preset] || presets.photo;
    const scale=Math.min(1,settings.edge/Math.max(source.width,source.height));
    const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
    const canvas=canvasFor(source,width,height);
    // Preserve PNG artwork and alpha losslessly; never flatten transparent pixels.
    const lossless=original.type==='image/png'||hasAlpha(canvas);
    const reusable=allowOriginal&&scale===1&&/^comootd-prepared\.(webp|png|jpg)$/.test(original.name);
    let blob=reusable?original:await encode(canvas,lossless?'image/png':'image/webp',.9);
    if(!reusable && !lossless && blob.size>settings.target) blob=await encode(canvas,'image/webp',.85);
    if(allowOriginal && scale===1 && original.size<=blob.size) blob=original;
    const ext=blob.type==='image/png'?'png':blob.type==='image/jpeg'?'jpg':'webp';
    const detail=new File([blob],`comootd-prepared.${ext}`,{type:blob.type,lastModified:Date.now()});
    let thumbnail=null,thumbWidth=0;
    if(Math.max(width,height)>640) {
      const ratio=640/Math.max(width,height);thumbWidth=Math.max(1,Math.round(width*ratio));
      const thumb=canvasFor(source,thumbWidth,Math.max(1,Math.round(height*ratio)));
      thumbnail=await encode(thumb,blob.type,.88);thumb.width=thumb.height=1;
      if(thumbnail.type!==blob.type) {thumbnail=null;thumbWidth=0;}
    }
    canvas.width=canvas.height=1;
    const result={detail,thumbnail,width,height,thumbWidth,ext,preset,originalBytes:original.size};
    prepared.set(detail,result);
    return result;
  }
  async function decode(file) {
    const url=URL.createObjectURL(file),image=new Image();
    try {image.src=url;await image.decode();
      if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>32000000) throw Error('Resolusi terlalu besar. Gunakan gambar maksimal 32 megapiksel.');
      return image;
    } finally {URL.revokeObjectURL(url);}
  }
  async function prepare(file,preset='photo') {
    const ready=prepared.get(file);if(ready && ready.preset===preset) return ready;
    validate(file);
    let jobs=pending.get(file);if(!jobs){jobs=new Map();pending.set(file,jobs);}
    if(!jobs.has(preset)) jobs.set(preset,(async()=>{
      await validateSource(file);
      const image=await decode(file);
      return fromCanvas(image,file,preset,true);
    })().catch(error=>{jobs.delete(preset);throw error;}));
    return jobs.get(preset);
  }
  function thumbnailPath(path) {return String(path || '').replace(marker,(full,w,t,ext)=>Number(t)>0?full.replace(`.${ext}`,`-thumb.${ext}`):full);}
  function paths(paths) {return [...new Set(paths.filter(Boolean).flatMap(path=>[path,thumbnailPath(path)]))];}
  async function upload(storage,base,file,preset='photo',maxBytes=5*1024*1024) {
    const result=await prepare(file,preset);
    if(result.detail.size>maxBytes) throw Error('Gambar masih terlalu besar tanpa menurunkan kualitas. Coba sumber berukuran lebih kecil.');
    const path=`${base}-opt1-w${result.width}-t${result.thumbWidth}.${result.ext}`;
    const uploaded=[];
    try {
      // Only publish the main path once both variants exist.
      for(const [key,blob] of [[thumbnailPath(path),result.thumbnail],[path,result.detail]]) {
        if(!blob) continue;
        const {error}=await storage.upload(key,blob,{cacheControl:'31536000',upsert:false,contentType:blob.type});
        if(error) throw error;uploaded.push(key);
      }
      return path;
    } catch(error) {
      if(uploaded.length)try{const cleanup=await storage.remove(uploaded);if(cleanup?.error)console.warn('Image cleanup incomplete',cleanup.error);}catch(cleanupError){console.warn('Image cleanup incomplete',cleanupError);}
      throw error;
    }
  }
  function attributes(src,sizes='(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw') {
    const match=String(src||'').match(marker);if(!match || Number(match[2])===0) return '';
    const esc=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return `srcset="${esc(thumbnailPath(src))} ${Number(match[2])}w, ${esc(src)} ${Number(match[1])}w" sizes="${esc(sizes)}"`;
  }
  function summary(file) {const r=prepared.get(file);return r?`${bytes(r.originalBytes)} → ${bytes(file.size)} · ${r.width} × ${r.height} · ${file.type==='image/png'?'PNG':'WebP/JPG'}`:'';}
  const previews=new Map();
  function clearPreview(input) {
    const entry=previews.get(input);if(!entry)return;
    entry.urls.forEach(url=>URL.revokeObjectURL(url));entry.node.remove();previews.delete(input);
  }
  document.addEventListener('change',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.type!=='file'||!input.accept.includes('image'))return;
    clearPreview(input);
    // The cropper already provides an optimized preview and size summary.
    if(input.dataset.imageCropperBound || input.multiple || !input.files?.[0])return;
    const file=input.files[0],node=document.createElement('details');
    node.className='image-optimization-preview';
    const title=document.createElement('summary');title.textContent='Menyiapkan versi ringan…';node.append(title);input.after(node);
    const entry={node,urls:[]};previews.set(input,entry);
    prepare(file,presetForInput(input)).then(result=>{
      if(!input.isConnected||previews.get(input)!==entry||input.files?.[0]!==file)return;
      title.textContent=`Preview hasil · ${summary(result.detail)}`;
      const grid=document.createElement('div');grid.className='image-optimization-comparison';
      for(const [label,blob] of [['Sumber',file],['Hasil upload',result.detail]]) {
        const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');
        const url=URL.createObjectURL(blob);entry.urls.push(url);img.src=url;img.alt=label;caption.textContent=label;
        figure.append(img,caption);grid.append(figure);
      }
      node.append(grid);
    }).catch(error=>{if(previews.get(input)===entry)title.textContent=error.message;});
  });
  new MutationObserver(records=>{
    if(records.some(record=>record.removedNodes.length)) for(const input of previews.keys())if(!input.isConnected)clearPreview(input);
  }).observe(document.documentElement,{childList:true,subtree:true});
  window.COMOOTDImageOptimizer=Object.freeze({prepare,fromCanvas,upload,paths,thumbnailPath,attributes,summary,presetForInput});
})();
