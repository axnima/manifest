const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
let rows = null;
let selectedFile = null;
let generated = null;
let history = [];
let busy = false;
let fileVersion = 0;
const node = (tag,className='',text) => {
  const el=document.createElement(tag);
  if(className) el.className=className;
  if(text!==undefined) el.textContent=text;
  return el;
};
const monthLabel = month => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'});
function message(role,text) {
  const bubble=node('div',`chat-message ${role}`);
  bubble.append(node('strong','',role==='user'?'You':role==='error'?'Request failed':'Sealed'),node('p','',text));
  $('chat-log').append(bubble);
  while($('chat-log').children.length>24) $('chat-log').firstElementChild.remove();
  $('chat-log').scrollTop=$('chat-log').scrollHeight;
}
function resetChat() {
  history=[];generated=null;
  $('chat-log').replaceChildren();
  message('assistant','Upload monthly revenue, then ask for next month’s forecast. After generation, ask me to change the chart, reorder the cards, or add a table.');
  $('export').disabled=true;
  $('schema').textContent='Send a message to generate a component specification.';
  $('provenance').textContent='AI chooses the layout. Your CSV supplies the numbers.';
  $('component-count').textContent='No generation yet';
  setTab(false);renderSource();
}
function renderSource() {
  const root=$('dashboard');root.replaceChildren();
  $('preview-state').textContent=rows?'CSV loaded · not AI-generated':'Waiting for your data';
  const panel=node('div','empty-state');
  panel.append(node('span','empty-symbol',rows?'▤':'✧'),node('h2','',rows?'Your data is ready.':'A dashboard starts with a question.'),node('p','',rows?'Send a chat message to create your forecast dashboard. The rows below are your uploaded source data.':'Upload the sample revenue CSV, connect Gemini, and ask for a forecast. Components appear only after a successful AI response.'));
  root.append(panel);
  if(rows) root.append(dataTable(rows.map(row=>({...row,forecast:false}))));
}
function renderFile() {
  $('file-list').replaceChildren();$('source-count').textContent=rows?'1':'0';
  if(!selectedFile) return;
  const row=node('div','file-row'),details=node('div','file-details');
  details.append(node('strong','',selectedFile),node('small','',`${rows.length} months · ${money(rows.reduce((sum,r)=>sum+r.revenue,0))} total`));
  const remove=node('button','remove-file','×');remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label','Remove uploaded CSV');
  remove.onclick=()=>{fileVersion++;rows=null;selectedFile=null;renderFile();resetChat();$('status').textContent='CSV removed. Upload a file to start again.';};
  row.append(node('span','file-icon','CSV'),details,remove);$('file-list').append(row);
}
function useCSV(text,name) {
  rows=RevenueModel.parseCSV(text);selectedFile=name;renderFile();resetChat();
  $('status').textContent=`Read ${rows.length} monthly rows. Nothing has been sent to Google yet.`;
}
async function upload(files) {
  if(busy) return;
  const version=++fileVersion;
  rows=null;selectedFile=null;renderFile();resetChat();
  if(files.length!==1){$('status').textContent='Choose one CSV at a time.';return;}
  const file=files[0];
  if(!/\.csv$/i.test(file.name)||file.size>RevenueModel.MAX_BYTES){$('status').textContent='Choose a .csv file up to 100 KB.';return;}
  setBusy(true);
  try {const text=await file.text();if(version===fileVersion)useCSV(text,file.name);}
  catch(error){if(version===fileVersion)$('status').textContent=error.message;}
  finally{setBusy(false);}
}
function dataTable(series) {
  const wrap=node('div','data-table-wrap'),table=node('table','data-table'),head=node('thead'),header=node('tr');
  const caption=node('caption','sr-only','Monthly revenue in USD, with actual and forecast values identified');table.append(caption);
  for(const title of ['Month','Revenue (USD)','Type']){const th=node('th','',title);th.scope='col';header.append(th);}head.append(header);table.append(head);
  const body=node('tbody');
  for(const item of series){const tr=node('tr',item.forecast?'forecast-row':'');tr.append(node('td','',monthLabel(item.month)),node('td','',money(item.revenue)),node('td','',item.forecast?'Forecast':'Actual'));body.append(tr);}
  table.append(body);wrap.append(table);return wrap;
}
function svgNode(tag,attributes={},text) {
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attributes))el.setAttribute(key,String(value));
  if(text!==undefined)el.textContent=text;
  return el;
}
function chart(series,type) {
  const width=Math.max(420,series.length*48),height=270,left=76,top=24,bottom=44,right=30;
  const plotWidth=width-left-right,plotHeight=height-top-bottom;
  const max=Math.max(...series.map(r=>r.revenue),1)*1.12;
  const x=i=>left+(i+.5)*plotWidth/series.length;
  const y=value=>top+plotHeight*(1-value/max);
  const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':series.map(r=>`${r.month}: ${money(r.revenue)} ${r.forecast?'forecast':'actual'}`).join('; ')});
  for(let i=0;i<=4;i++){const value=max*i/4;svg.append(svgNode('line',{x1:left,x2:width-right,y1:y(value),y2:y(value),class:'chart-grid'}),svgNode('text',{x:left-10,y:y(value)+4,'text-anchor':'end',class:'chart-axis'},new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(value)));}
  if(type==='lineChart'){
    const actual=series.slice(0,-1).map((r,i)=>`${x(i)},${y(r.revenue)}`).join(' ');
    svg.append(svgNode('polyline',{points:actual,class:'actual-line'}));
    const last=series.length-1;
    svg.append(svgNode('line',{x1:x(last-1),x2:x(last),y1:y(series[last-1].revenue),y2:y(series[last].revenue),class:'forecast-line'}));
  }
  series.forEach((r,i)=>{
    if(type==='barChart')svg.append(svgNode('rect',{x:x(i)-plotWidth/series.length*.28,y:y(r.revenue),width:plotWidth/series.length*.56,height:Math.max(1,top+plotHeight-y(r.revenue)),rx:4,class:r.forecast?'forecast-bar':'actual-bar'}));
    else svg.append(svgNode('circle',{cx:x(i),cy:y(r.revenue),r:5,class:r.forecast?'forecast-point':'actual-point'}));
    svg.append(svgNode('text',{x:x(i),y:height-18,'text-anchor':'middle',class:'chart-axis'},monthLabel(r.month)));
  });
  const wrap=node('div',series.length>8?'revenue-chart wide':'revenue-chart');wrap.append(svg);return wrap;
}
function renderDashboard() {
  const {layout,analysis,meta}=generated,root=$('dashboard');root.replaceChildren();
  const head=node('div','dashboard-heading'),intro=node('div');
  intro.append(node('h2','',layout.title),node('p','',`${analysis.observations} uploaded months · forecast for ${monthLabel(analysis.nextMonth)}`));head.append(intro);root.append(head);
  const grid=node('div','generated-grid');
  for(const c of layout.components){
    const card=node('section',c.type==='metric'?'metric generated-metric':'generated-card');
    card.append(node('h3',c.type==='metric'?'metric-title':'',c.title));
    if(c.type==='metric'){
      const value=analysis[c.dataKey];
      card.append(node('div','metric-value',c.dataKey==='monthlyGrowth'?(value===null?'N/A':`${value}%`):money(value)));
      const descriptions={totalRevenue:'Total of uploaded months',lastMonthRevenue:`Actual · ${monthLabel(rows[rows.length-1].month)}`,nextMonthForecast:`Trend estimate · ${monthLabel(analysis.nextMonth)}`,monthlyGrowth:'Last actual month vs. previous'};
      card.append(node('p','metric-detail',descriptions[c.dataKey]));
    }else if(c.type==='lineChart'||c.type==='barChart'){
      const legend=node('div','chart-key');legend.append(node('span','actual-key','● Actual revenue'),node('span','forecast-key','◇ Forecast'));card.append(legend,chart(analysis.revenueSeries,c.type));
    }else if(c.type==='table')card.append(dataTable(analysis.revenueSeries));
    else card.append(node('p','method-note',analysis.forecastMethod));
    grid.append(card);
  }
  root.append(grid,node('p','forecast-caveat',`Forecast: ${money(analysis.nextMonthForecast)} for ${monthLabel(analysis.nextMonth)}. ${analysis.forecastMethod}`));
  $('schema').textContent=JSON.stringify(generated,null,2);
  $('preview-state').textContent='Generated by Gemini · uploaded data';
  $('component-count').textContent=`${layout.components.length} components`;
  $('provenance').textContent=`${meta.model} · ${new Date(meta.generatedAt).toLocaleTimeString()} · ${meta.responseId?`Response ID: ${meta.responseId}`:'Provider did not return a response ID'}`;
  $('export').disabled=false;
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
$('prompt-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const prompt=$('prompt').value.trim(),apiKey=$('api-key').value.trim();
  if(!rows){$('status').textContent='Upload a revenue CSV first.';return;}
  if(!apiKey){$('connection').open=true;$('api-key').focus();$('status').textContent='Enter your Gemini API key. Use a Free Tier project to avoid charges.';return;}
  if(!prompt){$('status').textContent='Enter a message first.';return;}
  setBusy(true);message('user',prompt);$('status').textContent='Sending your data and message to Gemini. Waiting for component JSON…';
  try {
    const result=await RevenueModel.generate({apiKey,rows,prompt,history,previous:generated?.layout??null,signal:AbortSignal.timeout(45000)});
    generated=result;history.push({role:'user',text:prompt},{role:'assistant',text:result.layout.reply});history=history.slice(-8);
    renderDashboard();setTab(false);message('assistant',result.layout.reply);$('prompt').value='';$('connection').open=false;
    $('status').textContent='Dashboard updated from a real Gemini response. Ask a follow-up to refine it.';
  }catch(error){message('error',error.message);$('status').textContent=error.message+(generated?' The previous dashboard is unchanged.':' No dashboard was generated.');}
  finally{setBusy(false);$('prompt').focus();}
};
$('file-input').onchange=event=>{upload(Array.from(event.target.files));event.target.value='';};
$('load-sample').onclick=async()=>{
  if(busy)return;const version=++fileVersion;setBusy(true);
  try{const response=await fetch('sample-quarterly-revenue.csv');if(!response.ok)throw new Error('Could not load the sample CSV. Download it and upload it manually.');const text=await response.text();if(version===fileVersion)useCSV(text,'sample-quarterly-revenue.csv');}
  catch(error){$('status').textContent=error.message;}
  finally{setBusy(false);}
};
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();if(!busy)$('dropzone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('dragging');if(event==='drop'&&!busy)upload(Array.from(e.dataTransfer.files));});
$('api-key').oninput=()=>{$('connection-status').textContent=$('api-key').value.trim()?'Key entered · unverified':'Key needed';};
$('clear-key').onclick=()=>{$('api-key').value='';$('api-key').oninput();$('status').textContent='Key cleared. An in-flight request, if any, may still finish.';};
$('reset-chat').onclick=()=>{if(!busy){resetChat();$('status').textContent='Conversation cleared. Your uploaded CSV is still available.';}};
document.querySelectorAll('[data-prompt]').forEach(button=>button.onclick=()=>{$('prompt').value=button.dataset.prompt;$('prompt').focus();});
$('preview-tab').onclick=()=>setTab(false);$('schema-tab').onclick=()=>setTab(true);
for(const id of ['preview-tab','schema-tab'])$(id).onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const json=event.key==='End'||(event.key!=='Home'&&id==='preview-tab');setTab(json);$(json?'schema-tab':'preview-tab').focus();}};
$('export').onclick=()=>{
  if(!generated)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(generated,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download='revenue-dashboard.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('privacy-button').onclick=()=>$('privacy-dialog').showModal();$('close-dialog').onclick=()=>$('privacy-dialog').close();
resetChat();
