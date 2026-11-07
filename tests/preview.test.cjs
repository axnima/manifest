const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const handlers={},messages=[];
const parent={postMessage:message=>messages.push(message)};
vm.runInNewContext(fs.readFileSync(require.resolve('../public/preview.js'),'utf8'),{
  parent,addEventListener:(type,handler)=>{handlers[type]=handler},
  URL:{createObjectURL:()=> 'blob:null/generated-test',revokeObjectURL:()=>{}},
  Blob:class {},document:{createElement:()=>({}),body:{append:()=>{}}}
});
handlers.error({message:'Failed to connect to MetaMask',filename:'chrome-extension://wallet/scripts/inpage.js'});
handlers.unhandledrejection({reason:{message:'Failed to connect to MetaMask',stack:'Error\n at connect (moz-extension://wallet/inpage.js:1:2)'}});
assert.equal(messages.length,0,'Extension errors must not mark the dashboard as failed');
handlers.message({source:parent,data:{type:'render',javascript:'test'}});
handlers.error({message:'Failed to connect to MetaMask',filename:'blob:null/generated-test'});
handlers.unhandledrejection({reason:{message:'Dashboard failure',stack:'Error\n at blob:null/generated-test:1:2'}});
handlers.unhandledrejection({reason:{message:'Mixed stack',stack:'Error\n at chrome-extension://wallet/inpage.js:1:2\n at blob:null/generated-test:1:2'}});
handlers.error({message:'Unknown source failure'});
assert.deepEqual(messages.map(message=>message.message),['Failed to connect to MetaMask','Dashboard failure','Mixed stack','Unknown source failure']);
assert.ok(messages.every(message=>message.type==='preview-error'));
console.log('Preview checks passed: extension-origin noise excluded; generated, mixed, and unknown-source failures preserved.');
