(() => {
  let loaded=false, bundleUrl='';
  const fromExtension=event=>{
    const source=[event.filename,event.error?.stack,event.reason?.stack].filter(value=>typeof value==='string').join('\n');
    return /(?:chrome|moz|safari-web)-extension:\/\//.test(source)&&!(bundleUrl&&source.includes(bundleUrl));
  };
  const report=message=>parent.postMessage({type:'preview-error',message:String(message).slice(0,1500)},'*');
  addEventListener('error',event=>{if(!fromExtension(event))report(event.message||'Generated script failed.');});
  addEventListener('unhandledrejection',event=>{if(!fromExtension(event))report(event.reason?.message||'Generated promise rejected.');});
  addEventListener('message',event=>{
    if(loaded||event.source!==parent||event.data?.type!=='render'||typeof event.data.javascript!=='string'||event.data.javascript.length>2*1024*1024)return;
    loaded=true;
    const url=URL.createObjectURL(new Blob([event.data.javascript],{type:'text/javascript'}));
    bundleUrl=url;
    const script=document.createElement('script');script.src=url;
    script.onload=()=>URL.revokeObjectURL(url);
    script.onerror=()=>{URL.revokeObjectURL(url);report('Could not load compiled React.');};
    document.body.append(script);
  });
})();
