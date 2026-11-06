const assert = require('node:assert/strict');
const {makeSpec,validateFile,prompts} = require('./dist/model.js');
for(const [kind,prompt] of Object.entries(prompts)){const spec=makeSpec(prompt);assert.equal(spec.kind,kind);assert.equal(spec.demo,true);assert.ok(spec.components.length>0);assert.deepEqual(JSON.parse(JSON.stringify(spec)),spec);}
for(const bad of ['', '   ', null, 'x'.repeat(2001)]) assert.throws(()=>makeSpec(bad));
assert.equal(validateFile({name:'REPORT.CSV',size:10485760}),null);
assert.ok(validateFile({name:'data.csv',size:10485761}));
assert.ok(validateFile({name:'report.html',size:10}));
assert.ok(validateFile({name:'report.csv.exe',size:10}));
const components=makeSpec(prompts.revenue).components;
assert.equal(components[1].values.reduce((a,b)=>a+b,0),1240000);
assert.equal(components[2].items.reduce((sum,item)=>sum+item.value,0),1240000);
console.log('Passed: three dashboard presets, prompt bounds, file validation, JSON round trips, and revenue totals.');
