const fs=require('node:fs'),path=require('node:path'),{Resvg}=require('@resvg/resvg-js');
const root=path.resolve(__dirname,'..');
const svg=fs.readFileSync(path.join(root,'site/assets/favicon.svg'),'utf8');
const png=new Resvg(svg,{fitTo:{mode:'width',value:256}}).render().asPng();fs.writeFileSync(path.join(__dirname,'icon.png'),png);
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);fs.writeFileSync(path.join(__dirname,'icon.ico'),Buffer.concat([header,png]));
if(!fs.existsSync(path.join(root,'dist/studio/index.html')))throw Error('Run npm run build from the repository root first');
console.log('Desktop icon and bundled studio are ready.');
