const $ = (id) => document.getElementById(id);
let spec = DemoModel.makeSpec(DemoModel.prompts.revenue);
let files = [{name:'Q3_revenue_2026.csv',size:24576,sample:true},{name:'Quarterly_strategy.pdf',size:1258291,sample:true}];
function node(tag, className, text) { const el = document.createElement(tag); if(className) el.className=className; if(text!==undefined) el.textContent=text; return el; }
function renderFiles() {
  $('file-list').replaceChildren();
  files.forEach((file,index) => {
    const row=node('div','file-row');
    row.append(node('span','file-icon',file.name.split('.').pop().toUpperCase()));
    const details=node('div','file-details'); details.append(node('strong','',file.name),node('small','',`${file.size>=1048576?(file.size/1048576).toFixed(1)+' MB':Math.ceil(file.size/1024)+' KB'} · ${file.sample?'Sample source':'Local attachment · not analyzed'}`));
    const remove=node('button','remove-file','×'); remove.type='button'; remove.setAttribute('aria-label',`Remove ${file.name}`); remove.onclick=()=>{files.splice(index,1);renderFiles();};
    row.append(details,remove); $('file-list').append(row);
  });
  $('source-count').textContent=files.length;
}
function addFiles(incoming) {
  let added=0;const errors=[];
  for(const file of incoming){const error=DemoModel.validateFile(file);if(error){errors.push(`${file.name}: ${error}`);continue;}if(files.length>=8){errors.push('Attach up to 8 files for this demo.');break;}if(!files.some(f=>f.name===file.name&&f.size===file.size)){files.push({name:file.name,size:file.size,sample:false});added++;}}
  renderFiles();$('status').textContent=errors.length?errors.join(' '):`${added} file${added===1?'':'s'} attached locally. Preview still uses sample data.`;
}
function render() {
  const root=$('dashboard');root.replaceChildren();const head=node('div','dashboard-heading');const intro=node('div');intro.append(node('h2','',spec.title),node('p','','A little clarity on the quarter. All figures are illustrative.'));head.append(intro,node('span','period',spec.period));root.append(head);
  for(const c of spec.components){
    if(c.type==='metrics'){const grid=node('div','metrics');for(const m of c.items){const card=node('div','metric');card.append(node('div','metric-title',m.label),node('div','metric-value',m.value));const change=node('div','metric-change','↗ '+m.change);change.append(node('span','',m.label==='Revenue target'?'above target':'vs. last quarter'));card.append(change);grid.append(card);}root.append(grid);}
    if(c.type==='barChart'){const card=node('div','chart-card');const heading=node('div','chart-heading');heading.append(node('h3','',c.title));const legend=node('div','legend');const current=node('span','','This quarter');current.prepend(node('i'));const prior=node('span','','Previous quarter');prior.prepend(node('i','muted-dot'));legend.append(current,prior);heading.append(legend);card.append(heading);const chart=node('div','chart');chart.setAttribute('role','img');chart.setAttribute('aria-label',c.labels.map((label,i)=>`${label}: $${c.values[i].toLocaleString('en-US')}; previous quarter: $${c.previous[i].toLocaleString('en-US')}`).join('. '));const axis=node('div','axis');for(const label of ['$500K','$375K','$250K','$125K','$0']) axis.append(node('span','',label));const plot=node('div','plot');const heights=[['h58','h70'],['h66','h82'],['h85','h96']];c.labels.forEach((label,i)=>{const group=node('div','bar-group');group.append(node('div','bar previous '+heights[i][0]),node('div','bar '+heights[i][1]),node('span','bar-label',label));plot.append(group);});chart.append(axis,plot);card.append(chart);root.append(card);}
    if(c.type==='breakdown'){root.append(node('h3','region-heading',c.title));for(const item of c.items){const row=node('div','region-row');const name=node('span','region-name',item.label);name.prepend(node('i'));const meter=node('meter');meter.min=0;meter.max=1240000;meter.value=item.value;meter.setAttribute('aria-label',`${item.label} share of total revenue`);row.append(name,meter,node('span','region-number','$'+(item.value/1000).toFixed(1)+'K'));root.append(row);}}
    if(c.type==='insight'){const insight=node('div','insight');insight.append(node('span','','✧'));const text=node('span');text.append(node('strong','','A useful takeaway. '),document.createTextNode(c.text));insight.append(text);root.append(insight);}
    if(c.type==='summary'){const card=node('article','doc-card');card.append(node('h3','',c.title),node('p','',c.text));root.append(card);}
  }
  $('schema').textContent=JSON.stringify(spec,null,2);$('component-count').textContent=`${spec.components.length} components`;
}
function setTab(json) { $('dashboard').hidden=json;$('schema').hidden=!json;for(const [id,selected] of [['preview-tab',!json],['schema-tab',json]]){ $(id).setAttribute('aria-selected',String(selected));$(id).classList.toggle('selected',selected);$(id).tabIndex=selected?0:-1;} }
$('preview-tab').onclick=()=>setTab(false);$('schema-tab').onclick=()=>setTab(true);
for(const id of ['preview-tab','schema-tab']) $(id).onkeydown=(event)=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const json=event.key==='End'||(event.key!=='Home'&&id==='preview-tab');setTab(json);$(json?'schema-tab':'preview-tab').focus();}};
$('file-input').onchange=(event)=>{addFiles(event.target.files);event.target.value='';};
for(const event of ['dragenter','dragover']) $('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('dragging');});
for(const event of ['dragleave','drop']) $('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('dragging');if(event==='drop')addFiles(e.dataTransfer.files);});
document.querySelectorAll('[data-prompt]').forEach(button=>button.onclick=()=>{$('prompt').value=DemoModel.prompts[button.dataset.prompt];$('prompt').focus();});
$('prompt-form').onsubmit=async(event)=>{event.preventDefault();let next;try{next=DemoModel.makeSpec($('prompt').value);}catch(error){$('status').textContent=error.message;return;}$('generate').disabled=true;$('status').textContent='Assembling sample components…';$('dashboard').setAttribute('aria-busy','true');await new Promise(resolve=>setTimeout(resolve,650));spec=next;render();setTab(false);$('dashboard').removeAttribute('aria-busy');$('generate').disabled=false;$('status').textContent=`${spec.title} generated from demo fixtures. No request was sent to 0G.`;};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(spec,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download='sealed-dashboard.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='Component JSON exported. It contains sample data only.';};
$('privacy-button').onclick=()=>$('privacy-dialog').showModal();$('close-dialog').onclick=()=>$('privacy-dialog').close();
renderFiles();render();
