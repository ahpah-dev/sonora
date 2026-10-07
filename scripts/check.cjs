const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
for(const file of ['site/site.js','studio/sonora-pro.js','studio/sonora-studio.js','studio/sonora-piano.js','studio/sonora-design.js','studio/sonora-session.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const html=fs.readFileSync(path.join(root,'dist/studio/index.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
if(html.includes('sonoraVerification')||html.includes('verifyResults'))throw new Error('Local verification tools must not ship in production');
for(const file of ['index.html','site.css','site.js','assets/favicon.svg','assets/studio.jpg','assets/perform.jpg','assets/instrument.jpg','studio/index.html'])if(!fs.existsSync(path.join(root,'dist',file)))throw new Error(`Missing production file ${file}`);
console.log('All JavaScript parses; introduction, preview assets and studio are present.');
