const assert=require('node:assert/strict');
const {compile}=require('../scripts/compile.cjs');
(async()=>{
  const js=await compile("import {useState} from 'react'; export default function App(){const [n,setN]=useState(0);return <button style={{color:'pink'}} onClick={()=>setN(n+1)}>{n}</button>}");
  assert.ok(js.includes('pink'));assert.ok(js.length>1000);
  await assert.rejects(compile('import x from "../package.json";export default()=>x'));
  await assert.rejects(compile('export default()=>import("node:fs")'));
  await assert.rejects(compile('import x from "https://example.com/x.js";export default()=>x'));
  const fs=require('node:fs');
  const marker=require('node:path').join(require('node:os').tmpdir(),'manifest-compiler-executed-'+process.pid);
  await compile(`globalThis.process?.getBuiltinModule('fs').writeFileSync(${JSON.stringify(marker)},'bad');export default()=>null;`);
  assert.equal(fs.existsSync(marker),false,'Compilation must not execute generated code');
  console.log('Compiler checks passed: JSX/hooks, blocked imports, no execution of generated source.');
})().catch(e=>{console.error(e);process.exitCode=1;});
