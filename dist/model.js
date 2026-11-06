/* shortcut: deterministic fixtures only; replace with validated backend output when connecting 0G. */
const DemoModel = (() => {
  const prompts = {
    revenue: 'Give me a revenue overview for Q3, with monthly performance and a regional breakdown.',
    sales: 'Show sales performance, deal volume, and the strongest regions for Q3.',
    documents: 'Summarize the internal documents and highlight priorities for next quarter.'
  };
  function makeSpec(prompt) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2000) throw new Error('Enter a question between 1 and 2,000 characters.');
    const kind = /document|summari|priorit|internal/i.test(prompt) ? 'documents' : /sales|deal|pipeline/i.test(prompt) && !/revenue/i.test(prompt) ? 'sales' : 'revenue';
    const metrics = kind === 'sales' ? [
      {label:'Deals closed',value:'148',change:'+16 deals'},
      {label:'Win rate',value:'32.4%',change:'+3.1 pts'},
      {label:'Avg. deal size',value:'$8,378',change:'+5.3%'}
    ] : [
      {label:'Total revenue',value:'$1.24M',change:'+18.4%'},
      {label:'Monthly average',value:'$413.3K',change:'+18.4%'},
      {label:'Revenue target',value:'103.3%',change:'+3.3 pts'}
    ];
    return {version:1,demo:true,kind,title:kind==='documents'?'Company briefing':kind==='sales'?'Sales performance':'Revenue overview',period:'Q3 2026',components:kind==='documents' ? [
      {type:'summary',title:'A strong quarter, with room to grow',text:'In this fictional company brief, revenue reached $1.24M. North America contributed just over half of the total.'},
      {type:'summary',title:'The next quarter’s priorities',text:'Expand enterprise accounts in Europe, improve onboarding, and shorten the sales cycle.'},
      {type:'summary',title:'What to look into next',text:'Review regional conversion rates and compare customer acquisition costs before allocating the next budget.'}
    ] : [
      {type:'metrics',items:metrics},
      {type:'barChart',title:'Monthly revenue',unit:'USD',labels:['Jul','Aug','Sep'],values:[350000,410000,480000],previous:[290000,330000,427297]},
      {type:'breakdown',title:'Revenue by region',items:[{label:'North America',value:644800},{label:'Europe',value:396800},{label:'Asia Pacific',value:198400}]},
      {type:'insight',text:'North America contributed 52% of revenue. September finished 37% above July.'}
    ]};
  }
  function validateFile(file) {
    if (!/\.(csv|pdf|txt|docx)$/i.test(file.name)) return 'Choose a CSV, PDF, TXT, or DOCX file.';
    if (file.size > 10 * 1024 * 1024) return 'Each file must be 10 MB or smaller.';
    return null;
  }
  return {prompts,makeSpec,validateFile};
})();
if (typeof module !== 'undefined') module.exports = DemoModel;
