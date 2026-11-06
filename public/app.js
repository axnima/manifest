const $ = id => document.getElementById(id);
let documents = [];
let generated = null;
let failedAttempt = null;
let history = [];
let busy = false;
const node = (tag,className='',text) => {
  const el=document.createElement(tag);
  if(className) el.className=className;
  if(text!==undefined) el.textContent=text;
  return el;
};
function message(role,text) {
  const bubble=node('div',`chat-message ${role}`);
  bubble.append(node('strong','',role==='user'?'You':role==='error'?'Request failed':'Manifest Finance'),node('p','',text));
  $('chat-log').append(bubble);
  while($('chat-log').children.length>24) $('chat-log').firstElementChild.remove();
  $('chat-log').scrollTop=$('chat-log').scrollHeight;
}
function resetChat() {
  clearTimeout(previewTimer);history=[];generated=null;failedAttempt=null;
  $('chat-log').replaceChildren();
  message('assistant','Upload your files, then tell me what to do: summarize, compare, extract a table, visualize data, or make a forecast. I will use the documents and your instructions.');
  $('export').disabled=true;
  $('schema').textContent='Send a message to generate React source.';
  $('provenance').textContent='Answers and components are generated from your files and instructions.';
  $('component-count').textContent='No generation yet';
  setTab(false);renderSource();
}
function renderSource() {
  const root=$('dashboard');root.replaceChildren();
  $('preview-state').textContent=documents.length?'Files ready · ask a question':'Waiting for your files';
  const panel=node('div','empty-state');
  panel.append(node('span','empty-symbol','▤'),node('h2','',documents.length?'What would you like to do?':'Start with a document.'),node('p','',documents.length?'Tell me what to extract, explain, compare, or visualize. No analysis has been sent to 0G yet.':'Upload documents, spreadsheets, images, or text, then ask a question.'));
  root.append(panel);
  for(const doc of documents){
    const section=node('section','generated-card');section.append(node('h3','',doc.name),node('p','method-note',doc.description));
    if(doc.text)section.append(node('pre','source-preview',doc.text.slice(0,2500)+(doc.text.length>2500?'\n… Preview truncated; full extracted text is sent when you ask.':'')));
    root.append(section);
  }
}
function renderFiles() {
  $('file-list').replaceChildren();$('source-count').textContent=documents.length;
  documents.forEach((doc,index)=>{
    const row=node('div','file-row'),details=node('div','file-details');
    details.append(node('strong','',doc.name),node('small','',doc.description));
    const remove=node('button','remove-file','×');remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label',`Remove ${doc.name}`);
    remove.onclick=()=>{if(busy)return;documents.splice(index,1);renderFiles();resetChat();uploadStatus('File removed. Conversation reset for the remaining files.');};
    row.append(node('span','file-icon',doc.name.split('.').pop().slice(0,5).toUpperCase()),details,remove);$('file-list').append(row);
  });
}
function uploadStatus(text,error=false) {
  $('upload-status').textContent=text;$('upload-status').classList.toggle('error',error);$('status').textContent=text;
}
async function upload(files) {
  if(busy||!files.length)return;
  setBusy(true);const errors=[];let added=0;
  try{
    for(const file of files){
      try{
        if(documents.length>=5)throw new Error('Up to 5 files can be attached. Remove one first.');
        if(documents.reduce((sum,d)=>sum+d.size,0)+file.size>DocumentModel.MAX_TOTAL)throw new Error('Total attachments exceed 8 MB.');
        uploadStatus(`Reading ${file.name}…`);
        const doc=await DocumentModel.readFile(file);documents.push(doc);added++;
      }catch(error){errors.push(`${file.name}: ${error.message}`);}
    }
    if(added){renderFiles();resetChat();}
    uploadStatus(`${added?`Loaded ${added} file(s). Ask a question to use their contents. `:''}${errors.join(' ')}`,errors.length>0);
  }finally{setBusy(false);}
}
let previewTimer;
function renderDashboard() {
  clearTimeout(previewTimer);
  const root=$('dashboard');root.replaceChildren();
  const frame=node('iframe','react-preview');frame.id='preview-frame';frame.title=generated.title;
  frame.setAttribute('sandbox','allow-scripts');
  frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
  frame.referrerPolicy='no-referrer';
  frame.onload=()=>frame.contentWindow.postMessage({type:'render',javascript:generated.javascript},'*');
  frame.src='preview.html';root.append(frame);
  previewTimer=setTimeout(()=>{if($('preview-frame')===frame){$('status').textContent='Compiled React has not mounted yet. Inspect the generated source or ask for a simpler component.';}},10000);
  $('schema').textContent=generated.source;
  $('preview-state').textContent='React compiled on the local server';$('component-count').textContent='Isolated React preview';
  $('provenance').textContent=`${generated.meta.model} · private routing · Request ${generated.meta.responseId||generated.meta.requestId} · ${generated.meta.usage?.total_tokens??'?'} tokens${generated.meta.estimatedCostUsd!=null?' · estimated $'+generated.meta.estimatedCostUsd.toFixed(5):''}`;
  $('export').disabled=false;
}
addEventListener('message',event=>{
  const frame=$('preview-frame');
  if(!frame||event.source!==frame.contentWindow||!['preview-ready','preview-error'].includes(event.data?.type))return;
  clearTimeout(previewTimer);
  if(event.data.type==='preview-error'){
    const text=typeof event.data.message==='string'?event.data.message.slice(0,1500):'Unknown runtime error';
    failedAttempt={source:generated.source,runtimeError:text};
    recordDiagnostics({requestId:generated.meta.requestId,model:generated.meta.model,stage:'runtime',success:false});
    message('error','React runtime error: '+text);$('status').textContent='The generated component failed at runtime. Ask 0G to fix the error.';
  }else{$('status').textContent='Generated React is running. Ask a follow-up to change it.';}
});
async function compileReact(source) {
  let response;
  try{response=await fetch('/api/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source}),signal:AbortSignal.timeout(20000)});}
  catch{throw new Error('Could not reach the local compiler. Restart npm start and try again.');}
  if(response.status===404||response.status===501)throw new Error('Restart npm start to enable the React compilation endpoint.');
  const result=await response.json();
  if(!response.ok||typeof result.javascript!=='string')throw new Error(result.error||'Compilation failed. Run npm install and restart npm start.');
  return result.javascript;
}
function setTab(json) {
  $('dashboard').hidden=json;$('schema').hidden=!json;
  for(const [id,selected] of [['preview-tab',!json],['schema-tab',json]]){$(id).setAttribute('aria-selected',String(selected));$(id).classList.toggle('selected',selected);$(id).tabIndex=selected?0:-1;}
}
function setBusy(value) {
  busy=value;
  for(const id of ['generate','file-input','load-sample','reset-chat','prompt']) $(id).disabled=value;
  document.querySelectorAll('.remove-file,[data-prompt]').forEach(button=>button.disabled=value);
  $('dashboard').setAttribute('aria-busy',String(value));
}
async function recordDiagnostics(data,persist=true) {
  $('diagnostics-output').textContent=JSON.stringify(data,null,2);
  if(!persist){$('diagnostics-status').textContent='Backend recorded inference metadata in .local-artifacts/inference.jsonl';return;}
  $('diagnostics-status').textContent='Saving local diagnostics…';
  try {
    const response=await fetch('/api/diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw new Error('Log save failed');
    $('diagnostics-status').textContent='Saved to .local-artifacts/inference.jsonl';
  }catch{$('diagnostics-status').textContent='Could not save diagnostics. Restart with npm start; details remain below.';}
}
$('prompt-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const prompt=$('prompt').value.trim();
  if(!documents.length){uploadStatus('Upload a file first.',true);return;}
  if(!prompt){$('status').textContent='Enter a message first.';return;}
  setBusy(true);message('user',prompt);$('status').textContent='Sending your data and message to 0G. Waiting for React source…';
  try {
    const result=await DocumentModel.generate({documents,prompt,history,previous:failedAttempt??generated?.source??null,signal:AbortSignal.timeout(200000),onDiagnostics:data=>recordDiagnostics(data,false)});
    $('status').textContent='React received. Compiling on the local server…';
    let javascript;
    const compileStarted=Date.now();
    try{javascript=await compileReact(result.source);}
    catch(error){
      failedAttempt={source:result.source,compilationError:error.message};
      await recordDiagnostics({requestId:result.meta.requestId,model:result.meta.model,stage:'compile',success:false,durationMs:Date.now()-compileStarted});
      throw error;
    }
    failedAttempt=null;
    await recordDiagnostics({requestId:result.meta.requestId,model:result.meta.model,stage:'compile',success:true,durationMs:Date.now()-compileStarted});
    generated={...result,javascript};history.push({role:'user',text:prompt},{role:'assistant',text:result.reply});history=history.slice(-8);
    renderDashboard();setTab(false);message('assistant',result.reply);$('prompt').value='';
    $('status').textContent='React compiled. Starting the isolated preview…';
  }catch(error){message('error',error.message);$('status').textContent=error.message+(generated?' The previous dashboard is unchanged.':' No dashboard was generated.');}
  finally{setBusy(false);$('prompt').focus();}
};
$('file-input').onchange=event=>{upload(Array.from(event.target.files));event.target.value='';};
$('load-sample').onclick=async()=>{
  if(busy)return;setBusy(true);
  let file;
  try{const response=await fetch('sample-quarterly-revenue.csv');if(!response.ok)throw new Error('Could not load the sample.');file=new File([await response.text()],'sample-quarterly-revenue.csv',{type:'text/csv'});}
  catch(error){uploadStatus(error.message,true);}
  finally{setBusy(false);}
  if(file)await upload([file]);
};
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();if(!busy)$('dropzone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('dragging');if(event==='drop'&&!busy)upload(Array.from(e.dataTransfer.files));});
$('reset-chat').onclick=()=>{if(!busy){resetChat();$('status').textContent='Conversation cleared. Your attached files are still available.';}};
document.querySelectorAll('[data-prompt]').forEach(button=>button.onclick=()=>{$('prompt').value=button.dataset.prompt;$('prompt').focus();});
$('preview-tab').onclick=()=>setTab(false);$('schema-tab').onclick=()=>setTab(true);
for(const id of ['preview-tab','schema-tab'])$(id).onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const json=event.key==='End'||(event.key!=='Home'&&id==='preview-tab');setTab(json);$(json?'schema-tab':'preview-tab').focus();}};
$('export').onclick=()=>{
  if(!generated)return;
  const url=URL.createObjectURL(new Blob([generated.source],{type:'text/plain'}));const link=node('a');link.href=url;link.download='GeneratedApp.jsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('privacy-button').onclick=()=>$('privacy-dialog').showModal();$('close-dialog').onclick=()=>$('privacy-dialog').close();
resetChat();
