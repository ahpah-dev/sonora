const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
for(const file of ['site/site.js','shared/assistant.js','shared/listening.js','shared/composition.js','studio/sonora-listening.js','desktop/main.cjs','desktop/engine.cjs','desktop/preload.cjs','studio/sonora-assistant.js','studio/sonora-pro.js','studio/sonora-studio.js','studio/sonora-piano.js','studio/sonora-acoustic.js','studio/sonora-design.js','studio/sonora-session.js','studio/sonora-timeline.js','studio/sonora-workflow.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const html=fs.readFileSync(path.join(root,'dist/studio/index.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const attributeContext={};vm.createContext(attributeContext);vm.runInContext(html.match(/function htmlAttribute\(value\)\{[^\n]+/)[0],attributeContext);
if(attributeContext.htmlAttribute('" onfocus="alert(1)<>&\'')!=='&#34; onfocus=&#34;alert(1)&#60;&#62;&#38;&#39;')throw new Error('Track attribute escaping failed');
if(html.includes('aria-label="${track.name}'))throw new Error('Track names must not interpolate raw HTML attributes');
if(html.includes('sonoraVerification')||html.includes('verifyResults'))throw new Error('Local verification tools must not ship in production');
for(const file of ['index.html','site.css','site.js','download/index.html','download/download.css','assets/favicon.svg','assets/studio.jpg','assets/perform.jpg','assets/instrument.jpg','studio/index.html'])if(!fs.existsSync(path.join(root,'dist',file)))throw new Error(`Missing production file ${file}`);
const bank=JSON.parse(fs.readFileSync(path.join(root,'dist/assets/acoustic/index.json'),'utf8'));
let recordings=0;const recordingPaths=new Set();
for(const instrument of Object.values(bank.banks))for(const sample of instrument.samples){
  if(!/^[a-z0-9-]+\.ogg$/.test(sample.file))throw Error('Invalid acoustic recording path');
  if(recordingPaths.has(sample.file))throw Error(`Duplicate acoustic recording: ${sample.file}`);recordingPaths.add(sample.file);
  const bytes=fs.readFileSync(path.join(root,'dist/assets/acoustic',sample.file));
  if(bytes.length!==sample.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==sample.sha256)throw Error(`Acoustic recording integrity failed: ${sample.file}`);
  recordings++;
}
for(const notice of ['README.md','LICENSE.txt','UPSTREAM-README.txt'])if(!fs.existsSync(path.join(root,'dist/assets/acoustic',notice)))throw Error(`Missing acoustic license notice: ${notice}`);
if(recordings!==118)throw Error('Incomplete acoustic bank');
console.log(`Verified ${recordings} bundled acoustic recordings and their license notices.`);
console.log('All JavaScript parses; introduction, preview assets and studio are present.');
