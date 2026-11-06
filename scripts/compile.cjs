const esbuild=require('esbuild');
const fs=require('node:fs');
const MAX_SOURCE=200*1024;
async function compile(source){
  if(typeof source!=='string'||!source.trim()||Buffer.byteLength(source)>MAX_SOURCE)throw new Error('Provide a JSX module between 1 byte and 200 KB.');
  const entry=`import React from 'react';
import { createRoot } from 'react-dom/client';
import App from 'generated-component';
const notify=(type,message)=>parent.postMessage({type,message:String(message).slice(0,1500)},'*');
class Boundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){notify('preview-error',error.message);}
  render(){return this.state.failed?React.createElement('p',{role:'alert'},'Generated component failed to render. See the chat error.'):this.props.children;}
}
function Ready(){React.useEffect(()=>notify('preview-ready','React mounted'),[]);return React.createElement(App);}
createRoot(document.getElementById('root')).render(React.createElement(Boundary,null,React.createElement(Ready)));`;
  const result=await esbuild.build({
    stdin:{contents:entry,resolveDir:require('node:path').resolve(__dirname,'..'),sourcefile:'preview-entry.jsx',loader:'jsx'},
    bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',jsx:'automatic',charset:'ascii',minify:true,
    define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent',
    plugins:[{name:'generated-module',setup(build){
      build.onResolve({filter:/^generated-component$/},args=>args.namespace==='generated'?{errors:[{text:'Generated code cannot import itself.'}]}:{path:'component.jsx',namespace:'generated'});
      build.onLoad({filter:/.*/,namespace:'generated'},()=>({contents:source,loader:'jsx'}));
      build.onResolve({filter:/.*/,namespace:'generated'},args=>{
        if(!['react','react/jsx-runtime','react/jsx-dev-runtime'].includes(args.path))return {errors:[{text:'Only React imports are supported. Use inline CSS and SVG; external packages, URLs, and file imports are blocked.'}]};
        return {path:require.resolve(args.path)};
      });
    }}]
  });
  return result.outputFiles[0].text;
}
if(require.main===module){
  (async()=>{
    let input='';for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>256*1024)throw new Error('Compilation request too large.');}
    const {source}=JSON.parse(input);const javascript=await compile(source);process.stdout.write(JSON.stringify({javascript}));
  })().catch(error=>{
    const errors=error.errors?.slice(0,3).map(e=>`${e.location?`Line ${e.location.line}:${e.location.column}: `:''}${e.text}`).join('\n');
    process.stdout.write(JSON.stringify({error:errors||error.message}));process.exitCode=1;
  });
}
module.exports={compile};
