const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=fs.readFileSync(path.join(root,'studio/sonora-before-studio.html'),'utf8'),session=fs.readFileSync(path.join(root,'studio/sonora-session.js'),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert(a>=0&&b>a,'test extraction anchors exist');return text.slice(a,b);}
const sandbox={Blob,clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),finiteNumber:(n,d)=>Number.isFinite(Number(n))?Number(n):d,project:{tempo:120,tracks:[]},notesForClip:(t,c)=>c.notes,stepsForClip:(t,c)=>c.steps};
vm.createContext(sandbox);
vm.runInContext(section(base,'      function rotateClipNotes(', '      function rotateClipSteps(')+section(base,'      function collectEvents(', '      function scheduler(')+section(session,'      function sessionWav(', '      async function sessionRenderWav('),sandbox);
async function run(){
  const rotated=sandbox.rotateClipNotes([{pitch:60,start:0,duration:4,velocity:.8}],1,16);
  assert.equal(rotated.length,2);assert.equal(rotated[0].firstPassOnly,true);assert.equal(rotated[1].start,15);assert.equal(rotated[1].duration,4);
  sandbox.project.tracks=[{id:'piano',type:'synth',clips:[{id:'trimmed',start:0,length:48,notes:rotated}]}];
  const events=sandbox.collectEvents();assert.deepEqual(Array.from(events,e=>e.beat),[0,15,31,47]);assert.equal(events[0].duration,1.5);assert.equal(events.at(-1).duration,.5);
  const trimmedAgain=sandbox.rotateClipNotes(rotated,2,16);assert.equal(trimmedAgain.filter(n=>n.firstPassOnly).length,1);assert.equal(trimmedAgain.filter(n=>!n.firstPassOnly).length,1);
  console.log('PASS trimmed sustains retain phase without retriggering their first-pass continuation');
  const buffer={length:4,numberOfChannels:2,sampleRate:48000,getChannelData:i=>new Float32Array(i?[.5,-.5,0,.25]:[1,-1,0,2])};
  for(const bits of [16,24]){const result=sandbox.sessionWav(buffer,bits,false),view=new DataView(await result.blob.arrayBuffer());assert.equal(view.getUint16(34,true),bits);assert.equal(view.getUint32(24,true),48000);assert.equal(view.getUint32(40,true),4*2*bits/8);assert.equal(view.byteLength,44+4*2*bits/8);assert.equal(result.peak,2);if(bits===16){assert.equal(view.getInt16(44,true),32767);assert.equal(view.getInt16(48,true),-32768);}else{assert.equal(view.getUint8(44),255);assert.equal(view.getUint8(46),127);assert.equal(view.getUint8(52),128);}}
  const normalized=sandbox.sessionWav(buffer,24,true);assert(Math.abs(normalized.peak*normalized.scale-Math.pow(10,-1/20))<1e-6);
  console.log('PASS stereo16/24-bit PCM byte order, full scale, clipping, sample rate and normalization');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
