const DocumentModel = (() => {
  const MODEL = '0G';
  const MAX_BYTES = 4 * 1024 * 1024;
  const MAX_TOTAL = 8 * 1024 * 1024;

  async function readFile(file, fetcher=fetch) {
    if(!file.size || file.size>MAX_BYTES) throw new Error('Choose a non-empty file up to 4 MB.');
    const ext=file.name.split('.').pop().toLowerCase();
    const bytes=new Uint8Array(await file.arrayBuffer());
    let mimeType;
    if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-') mimeType='application/pdf';
    else if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71) mimeType='image/png';
    else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255) mimeType='image/jpeg';
    else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP') mimeType='image/webp';
    if(mimeType?.startsWith('image/')){
      let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      return {name:file.name,size:file.size,mimeType,base64:btoa(binary),description:'Image ready for visual analysis'};
    }
    let text;
    if(mimeType==='application/pdf'||['docx','xlsx','pptx','odt'].includes(ext)){
      let response;
      try{response=await fetcher(`/api/extract?format=${mimeType==='application/pdf'?'pdf':ext}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(20000)});}
      catch{throw new Error('Could not read this document. Check your connection and try again.');}
      if(response.status===501||response.status===404)throw new Error('Document extraction is unavailable. Try a text file or contact the app administrator.');
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not extract this document.');text=result.text;
    }else{
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
      catch{throw new Error('This binary format is not supported. Export it as PDF, text, CSV, DOCX, XLSX, or PPTX.');}
      if(/[\x00-\x08\x0e-\x1f]/.test(text))throw new Error('This file is not readable text. Export it as PDF or a supported document format.');
    }
    if(typeof text!=='string'||!text.trim())throw new Error('No readable text was found in this file.');
    if(new TextEncoder().encode(text).length>1024*1024)throw new Error('Text exceeds 1 MB. Split the file into smaller documents.');
    return {name:file.name,size:file.size,mimeType:'text/plain',text,description:`${text.length.toLocaleString()} characters extracted`};
  }

  function validateComponent(value) {
    if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.length>120||typeof value.reply!=='string'||!value.reply.trim()||value.reply.length>4000||typeof value.source!=='string'||!value.source.trim()||new TextEncoder().encode(value.source).length>200*1024)throw new Error('The AI provider returned an invalid React module. Try again.');
    return {title:value.title,reply:value.reply,source:value.source};
  }
  // shortcut: a two-column monthly CSV only; use a CSV library for arbitrary text fields or other schemas.
  function parseCSV(text) {
    if(typeof text !== 'string' || new TextEncoder().encode(text).length > (100 * 1024)) throw new Error('Choose a CSV smaller than 100 KB.');
    const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
    const cells=line=>line.split(',').map(cell=>{
      cell=cell.trim();
      if(cell.startsWith('"') && cell.endsWith('"')) cell=cell.slice(1,-1);
      if(cell.includes('"')) throw new Error('Invalid CSV quoting. Use the sample format.');
      return cell;
    });
    const headers=cells(lines.shift());
    if(headers.length!==2 || headers[0]!=='month' || headers[1]!=='revenue_usd') throw new Error('CSV columns must be month,revenue_usd. Download the sample for the format.');
    if(lines.length<3 || lines.length>36) throw new Error('Provide 3–36 consecutive monthly revenue rows.');
    const rows=lines.map((line,index)=>{
      const fields=cells(line);
      if(fields.length!==2 || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(fields[0]) || !/^\d+(\.\d{1,2})?$/.test(fields[1])) throw new Error(`Row ${index+2}: use YYYY-MM and a non-negative dollar amount, without currency symbols or thousands separators.`);
      const revenue=Number(fields[1]);
      if(!Number.isFinite(revenue) || revenue>1e9) throw new Error(`Row ${index+2}: revenue must be at most 1 billion USD.`);
      return {month:fields[0],revenue};
    }).sort((a,b)=>a.month.localeCompare(b.month));
    const monthIndex=month=>Number(month.slice(0,4))*12+Number(month.slice(5))-1;
    for(let i=1;i<rows.length;i++) if(monthIndex(rows[i].month)-monthIndex(rows[i-1].month)!==1) throw new Error('Use one row per month, with no duplicate or missing months.');
    return rows;
  }

  function analyze(rows) {
    const n=rows.length;
    const cents=rows.map(row=>Math.round(row.revenue*100));
    const mean=cents.reduce((a,b)=>a+b,0)/n;
    const center=(n-1)/2;
    const slope=cents.reduce((sum,value,i)=>sum+(i-center)*(value-mean),0)/cents.reduce((sum,_,i)=>sum+(i-center)**2,0);
    const estimate=Math.max(0,Math.round(mean+slope*(n-center)))/100;
    const last=rows[n-1];
    const [year,month]=last.month.split('-').map(Number);
    const nextMonth=month===12?`${year+1}-01`:`${year}-${String(month+1).padStart(2,'0')}`;
    const previous=rows[n-2].revenue;
    return {
      currency:'USD', observations:n,
      totalRevenue:cents.reduce((a,b)=>a+b,0)/100,
      lastMonthRevenue:last.revenue,
      nextMonthForecast:estimate,
      monthlyGrowth:previous===0?null:Math.round((last.revenue/previous-1)*10000)/100,
      nextMonth,
      revenueSeries:[...rows.map(row=>({...row,forecast:false})),{month:nextMonth,revenue:estimate,forecast:true}],
      forecastMethod:`Linear trend fitted to ${n} consecutive monthly observations, projected one month ahead and floored at zero. This is an illustrative estimate, not a guarantee; seasonality and external factors are not modeled. Three months is a very limited basis for forecasting.`
    };
  }

  async function generate({documents,prompt,history=[],previous=null,signal,onDiagnostics=()=>{}},fetcher=fetch) {
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>2000)throw new Error('Enter a message between 1 and 2,000 characters.');
    if(!Array.isArray(documents)||!documents.length||documents.length>5)throw new Error('Attach 1–5 files first.');
    const verifiedCalculations=[];
    for(const doc of documents){
      if(/forecast|predict|project/i.test(prompt)&&/^month,revenue_usd\r?\n/.test(doc.text?.trim()||'')){
        try{verifiedCalculations.push({source:doc.name,...analyze(parseCSV(doc.text))});}catch{}
      }
    }
    let response;
    try{response=await fetcher('/api/generate',{
      method:'POST',headers:{'Content-Type':'application/json'},signal,
      body:JSON.stringify({documents:documents.map(({name,text,mimeType,base64})=>base64?{name,mimeType,base64}:{name,text}),prompt,history:history.slice(-8),previous,verifiedCalculations})
    });}catch(error){
      if(error.name==='AbortError'||error.name==='TimeoutError')throw new Error('Generation timed out or was cancelled. The provider may still finish and charge for this request.');
      throw new Error('Could not reach the analysis service. Check your connection and try again.');
    }
    let result;
    try{result=await response.json();}catch{throw new Error('The analysis service returned an unreadable response. Try again later.');}
    if(result.diagnostics){try{await onDiagnostics(result.diagnostics);}catch{}}
    if(!response.ok)throw new Error(result.error||`Analysis request failed (HTTP ${response.status}).`);
    return {...validateComponent(result),meta:result.meta};
  }
  return {MODEL,MAX_BYTES,MAX_TOTAL,readFile,parseCSV,analyze,validateComponent,generate};
})();
if(typeof module!=='undefined') module.exports=DocumentModel;
