const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.join(__dirname,'..');
(async()=>{
  const server=spawn('python3',['scripts/server.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  let browser;
  try{
    const origin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);server.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/localhost:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});server.once('error',reject);});
    browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{})});
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let calls=0,mode='normal',context,latestSource,compileCalls=0,networkLeaks=0;
    await page.route('**/api/diagnostics',route=>route.fulfill({json:{saved:true}}));
    await page.route('**/api/compile',async route=>{compileCalls++;const request=route.request();assert.deepEqual(Object.keys(request.postDataJSON()),['source']);assert.equal(request.headers()['x-goog-api-key'],undefined);assert.ok(!request.postData().includes('test-key'));await route.continue();});
    await page.route('https://example.com/**',async route=>{networkLeaks++;await route.abort();});
    await page.route('**/api/generate',async route=>{
      calls++;assert.equal(route.request().headers().authorization,undefined);
      const body=route.request().postDataJSON();context={previousModule:body.previous,conversation:body.history,documents:body.documents};
      if(mode==='truncated'){await route.fulfill({status:502,json:{error:'0G MAX_TOKENS'}});return;}
      let source=`import {useState,useEffect} from 'react';
export default function App(){
 const [count,setCount]=useState(0);const [network,setNetwork]=useState('checking');
 let access='';try{access=parent.document.getElementById('api-key').value}catch{access='blocked'}
 useEffect(()=>{fetch('https://example.com/should-not-leak').then(()=>setNetwork('bad')).catch(()=>setNetwork('blocked'))},[]);
 return <main style={{padding:24,background:'#fff1f8',fontFamily:'system-ui'}}><h1 style={{color:'#db2777'}}>Projected profits</h1><svg aria-label="Pink profit graph" width="260" height="120"><rect width="80" height="100" fill="#db2777"/></svg><p>Source: finance-team-memo.pdf</p><button onClick={()=>setCount(count+1)}>Explore {count}</button><p id="parent-access">Parent access: {access}</p><p id="network">Network: {network}</p></main>;
}`;
      if(mode==='followup')source="export default function App(){return <section><h1>Revised React view</h1><p>Updated from the previous source.</p></section>}";
      if(mode==='invalid')source='export default function App(){return <div>}';
      if(mode==='runtime')source="export default function App(){throw new Error('Test render failure')}";
      latestSource=source;
      await route.fulfill({json:{title:'Profit view',reply:'Here is the custom React view.',source,meta:{requestId:'local-id',model:'0gm-1.0-35b-a3b',responseId:'test-response',trustMode:'private',usage:{total_tokens:2000},estimatedCostUsd:0.001}}});
    });
    await page.goto(origin);
    await page.getByRole('heading',{name:'Your numbers. A clearer picture.'}).waitFor();
    assert.equal(calls,0);
    await page.locator('.ocean-credit').click({trial:true});
    const ocean=page.locator('#ascii-ocean');
    assert.equal(await page.locator('.ocean-backdrop').evaluate(el=>getComputedStyle(el).position),'fixed');
    assert.equal(await page.locator('.ocean-backdrop').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.waitForFunction(()=>document.getElementById('ascii-ocean').dataset.ready==='true');
    assert.ok(await ocean.evaluate(canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let varied=0;for(let i=0;i<data.length;i+=4)if(data[i]!==data[0]||data[i+1]!==data[1])varied++;
      return varied>100;
    }));
    await page.getByRole('button',{name:'Pause motion',exact:true}).click();
    const pausedOcean=await ocean.evaluate(canvas=>canvas.toDataURL());
    await page.waitForTimeout(150);
    assert.equal(await ocean.evaluate(canvas=>canvas.toDataURL()),pausedOcean);
    assert.equal(await ocean.getAttribute('data-motion'),'paused');
    await page.getByRole('button',{name:'Resume motion',exact:true}).click();
    assert.equal(await ocean.getAttribute('data-motion'),'running');

    for(const width of [768,390,320]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.getElementById('ascii-ocean').dataset.motion==='still');
    assert.equal(await ocean.getAttribute('data-motion'),'still');
    assert.equal(await page.getByRole('button',{name:'Still scene',exact:true}).isDisabled(),true);
    await page.locator('.privacy-facts summary').click();
    assert.ok(await page.getByText('Local technical logs and 0G billing records keep metadata.',{exact:false}).isVisible());
    await page.setViewportSize({width:1440,height:1100});
    await page.getByRole('link',{name:'Open studio'}).click();
    await page.waitForURL('**/studio.html');
    await page.getByRole('link',{name:'Manifest HQ home',exact:true}).click();
    await page.waitForURL('**/index.html');
    await page.getByRole('link',{name:'Open studio'}).click();
    await page.waitForURL('**/studio.html');
    assert.equal(await page.title(),'manifest HQ');
    assert.equal(await page.locator('#file-input').evaluate(el=>getComputedStyle(el).opacity),'0');
    await page.locator('#file-input').focus();
    assert.equal(await page.locator('#dropzone').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.keyboard.press('Enter')]);
    await chooser.setFiles(path.join(root,'samples/finance/finance-team-memo.pdf'));
    await page.waitForFunction(()=>document.getElementById('upload-status').textContent.includes('Loaded 1'));
    await page.locator('#prompt').fill('Project profits and make the graph pink.');await page.locator('#generate').click();
    const frame=page.frameLocator('#preview-frame');
    await frame.getByRole('heading',{name:'Projected profits'}).waitFor({timeout:20000});
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('React is running'));
    assert.equal(await frame.locator('rect').evaluate(el=>getComputedStyle(el).fill),'rgb(219, 39, 119)');
    await frame.getByRole('button',{name:'Explore 0'}).click();await frame.getByRole('button',{name:'Explore 1'}).waitFor();
    assert.equal(await frame.locator('#parent-access').innerText(),'Parent access: blocked');
    await frame.getByText('Network: blocked',{exact:true}).waitFor();assert.equal(networkLeaks,0);
    assert.equal(await page.locator('#preview-frame').getAttribute('sandbox'),'allow-scripts');
    assert.ok(context.documents[0].text.includes('Acme'));assert.equal(await page.locator('#api-key').count(),0);
    assert.equal(calls,1);assert.equal(compileCalls,1);
    const firstSource=latestSource;
    await page.locator('#schema-tab').click();assert.equal(await page.locator('#schema').innerText(),firstSource);await page.locator('#preview-tab').click();
    const download=page.waitForEvent('download');await page.locator('#export').click();assert.equal((await download).suggestedFilename(),'GeneratedApp.jsx');
    mode='invalid';await page.locator('#prompt').fill('Update this');await page.locator('#generate').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Compilation failed'));
    assert.equal(await frame.getByRole('heading',{name:'Projected profits'}).count(),1);
    assert.equal(context.previousModule,firstSource);
    mode='followup';await page.locator('#prompt').fill('Replace the graph with a summary');await page.locator('#generate').click();
    await page.frameLocator('#preview-frame').getByRole('heading',{name:'Revised React view'}).waitFor();
    assert.equal(context.previousModule.source,'export default function App(){return <div>}');assert.ok(context.previousModule.compilationError.includes('Compilation failed'));assert.equal(context.conversation.length,2);
    mode='truncated';await page.locator('#prompt').fill('Expand the analysis');await page.locator('#generate').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('MAX_TOKENS'));
    assert.equal(await page.frameLocator('#preview-frame').getByRole('heading',{name:'Revised React view'}).count(),1);
    mode='runtime';await page.locator('#prompt').fill('Try another');await page.locator('#generate').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('failed at runtime'));
    assert.ok((await page.locator('#chat-log').innerText()).includes('Test render failure'));
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: ASCII render/pause/reduced motion, landing navigation, real backend compilation, pink JSX/SVG, React hooks, parent-key isolation, network blocking, source/export, follow-ups, compile/runtime/truncation errors, mobile. 0G backend responses intercepted; no live inference.');
  }finally{if(browser)await browser.close();server.kill('SIGTERM');}
})().catch(e=>{console.error(e);process.exitCode=1;});
