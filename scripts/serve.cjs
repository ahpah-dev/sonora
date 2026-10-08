const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist'),port=Number(process.env.PORT||4180);
if(!fs.existsSync(root))require('./build.cjs');
http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  // Verification UI exists only on this localhost server, never in dist/.
  const sourceRoot=path.resolve(__dirname,'..');
  if(pathname==='/__assistant-ui/'){
    // Local UI fixture uses a real proposal saved by the explicit live integration test.
    // This bridge and fixture are never copied to dist or the desktop package.
    const fixtureFile=path.join(sourceRoot,'screenshots/live-proposal.json');
    if(!fs.existsSync(fixtureFile)){res.writeHead(404);res.end('Run node scripts/assistant.test.cjs --live first');return;}
    const fixture=fs.readFileSync(fixtureFile,'utf8').replaceAll('<','\\u003c');
    const shim=`let fixtureListener=()=>{},fixtureCancelled=false;window.sonoraDesktop={status:async()=>({codex:{connected:true},api:false}),onEvent:callback=>{fixtureListener=callback;return ()=>{};},cancel:async()=>{fixtureCancelled=true;return true;},generate:async()=>{fixtureCancelled=false;for(const phase of ['connecting','composing','writing','validating']){if(fixtureCancelled)throw Error('Request cancelled');fixtureListener({kind:'progress',phase,message:({connecting:'Checking your Codex connection…',composing:'Composing your music…',writing:'Writing notes, clips and instrument settings…',validating:'Checking note ranges, instruments and edit scope…'})[phase]});await new Promise(resolve=>setTimeout(resolve,3000));}if(fixtureCancelled)throw Error('Request cancelled');fixtureListener({kind:'progress',phase:'complete',message:'Your proposal is ready to review.'});return ${fixture};}};`;
    let html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8').replace('<script>','<script>'+shim+'</script><script>');
    html=html.replace('</body>','<div style="position:fixed;bottom:2px;right:8px;z-index:99999;font:10px monospace;color:#b8efdb">Local UI fixture · simulated activity · real Codex proposal</div></body>');res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;
  }
  if(pathname==='/__verify/test.js'){
    const name=new URL(req.url,'http://localhost').searchParams.get('suite');
    const allowed=['editor','audio','session'];
    if(!allowed.includes(name)){res.writeHead(404);res.end();return;}
    fs.readFile(path.join(sourceRoot,'studio',`sonora-${name}.test.js`),(err,bytes)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','application/javascript');res.end(bytes);});return;
  }
  if(pathname==='/__verify/'){
    let html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8');
    const api='window.sonoraVerification={sessionWav,sessionRange,sessionPosition,sessionLoopClip,sessionStarter,sessionRenderWav,collectEvents,scheduler,audio,getProject:()=>project,replaceProject:next=>restoreProjectSnapshot(JSON.stringify(next)),getTrack,saveProject,notesForClip,pianoBank,pianoWarmNotes,pianoSamplesFor,pianoVelocityMix,pianoTouch,SYNTH_PRESETS,PIANO_PRESETS,proVoice,proDrumVoice,proSynth,liveNoteDown,liveNoteUp,selectedNotes};';
    html=html.replace('    })();\n  </script>',api+'\n    })();\n  </script>');
    const harness=fs.readFileSync(path.join(__dirname,'verify-ui.js'),'utf8');
    html=html.replace('</body>','<script>'+harness+'</script></body>');res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;
  }
  let file=path.resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(bytes);});
}).listen(port,'127.0.0.1',()=>console.log(`Sonora: http://127.0.0.1:${port}`));
