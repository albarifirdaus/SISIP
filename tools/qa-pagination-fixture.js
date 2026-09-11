(() => {
  if(!['localhost','127.0.0.1'].includes(location.hostname)) throw Error('Local QA only');
  const products=Array.from({length:80},(_,i)=>({id:`p${i+1}`,slug:`product-${i+1}`,name:`Product ${i+1}`,price:100000+i,genderTarget:'unisex',category:'top',styles:['Clean'],variants:[{id:`v${i+1}`,name:'Black'}],affiliatePlatform:'shopee',affiliateUrl:'https://shopee.co.id/test'}));
  const curators=Array.from({length:40},(_,i)=>({id:`c${i+1}`,userId:`c${i+1}`,handle:`curator-${i+1}`,displayName:`Curator ${i+1}`,jobTags:['Clean'],isActive:true,followerCount:2,lookCount:2,totalLikes:10}));
  const looks=Array.from({length:80},(_,i)=>({id:`l${i+1}`,slug:`look-${i+1}`,title:`Look ${i+1}`,gender:'Uniseks',styles:['Clean'],publisherType:'curator',creatorId:curators[i%40].id,curator:curators[i%40],items:[{productId:products[i].id,variantName:'Black'}],popularity:10,publishedAt:'2026-09-01'}));
  const state={products,looks,curators,articles:[],styleTags:[{name:'Clean'}]};
  window.qaPages=[];
  window.SISIPCloud={
    isConfigured:()=>true,publicUrl:v=>v,getSession:async()=>null,getCurrentUser:async()=>null,getMemberProfile:async()=>null,
    loadState:async()=>({...state,products:products.slice(0,24),looks:looks.slice(0,24),curators:curators.slice(0,12)}),
    loadDirectoryPage:async(kind,page,filters={})=>{
      window.qaPages.push({kind,page,filters});
      await new Promise(resolve=>setTimeout(resolve,filters.q==='slow'?180:15));
      if(filters.q==='error') throw Error('Expected QA error');
      const key=kind==='products'?'products':kind==='directory-curators'?'curators':kind==='journal'?'articles':'looks';
      let source=state[key];
      if(filters.q) source=source.filter(e=>(e.name||e.title||e.displayName).toLowerCase().includes(filters.q.toLowerCase()));
      if(filters.creator) source=source.filter(e=>e.creatorId===filters.creator);
      const pageSize=key==='curators'?12:24,total=source.length;
      page=Math.min(page,Math.max(1,Math.ceil(total/pageSize)));
      const entries=source.slice((page-1)*pageSize,page*pageSize);
      return {entries,total,page,pageSize,catalogue:{...state,[key]:entries}};
    },
    loadPublicContent:async(type,value,{byId=false}={})=>{
      const key={look:'looks',product:'products',curator:'curators',article:'articles'}[type];
      const entries=state[key].filter(e=>(byId?e.id:type==='curator'?e.handle:e.slug)===value);
      return entries.length?{...state,[key]:entries}:null;
    }
  };
})();
