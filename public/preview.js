(() => {
  let loaded=false;
  const report=message=>parent.postMessage({type:'preview-error',message:String(message).slice(0,1500)},'*');
  addEventListener('error',event=>report(event.message||'Generated script failed.'));
  addEventListener('unhandledrejection',event=>report(event.reason?.message||'Generated promise rejected.'));
  addEventListener('message',event=>{
    if(loaded||event.source!==parent||event.data?.type!=='render'||typeof event.data.javascript!=='string'||event.data.javascript.length>2*1024*1024)return;
    loaded=true;
    const url=URL.createObjectURL(new Blob([event.data.javascript],{type:'text/javascript'}));
    const script=document.createElement('script');script.src=url;
    script.onload=()=>URL.revokeObjectURL(url);
    script.onerror=()=>{URL.revokeObjectURL(url);report('Could not load compiled React.');};
    document.body.append(script);
  });
})();
