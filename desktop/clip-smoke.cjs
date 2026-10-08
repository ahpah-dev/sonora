'use strict';
// Production renderer, production preload and native proposal validation with deterministic provider output.
// No credentials, external model requests or user profile data are used.
const {app,BrowserWindow,protocol,net,ipcMain}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const assistant=require('../shared/assistant.js'),makeEngine=require('./engine.cjs').makeEngine;
app.setPath('userData',path.resolve(__dirname,`../desktop-release/assistant-test-profile-${Date.now()}`));
protocol.registerSchemesAsPrivileged([{scheme:'sonora-test',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const root=path.resolve(__dirname,'../dist'),requests=[],outputs=[];let window,refinementCalls=0;
const timer=setTimeout(()=>{console.error('Assistant renderer test timed out');app.exit(1);},60000);
const engine=makeEngine({binary:'unused',assistant,readApiKey:()=> 'native-test-key',notify:event=>window?.webContents.send('sonora:event',event),fetchImpl:async(_url,options)=>{
  const outgoing=JSON.parse(options.body);outputs.push(outgoing);const request=requests.at(-1),track=request.context.tracks.find(t=>t.id===request.context.editTarget.trackId),clip=track.clips.find(c=>c.id===request.context.editTarget.clipId);
  const length=request.prompt.includes('shorten')?8:request.prompt.includes('fallback')&&++refinementCalls===2?8:clip.length;
  const plan={summary:'Selected phrase refined with expressive timing.',title:null,tempo:null,tracks:[{action:'update',trackId:track.id,name:null,instrument:null,volume:request.prompt.includes('refuse')?.9:null,pan:null,mute:null,effectPreset:null,parameters:[],clips:[{name:'Refined phrase',start:clip.start,length,notes:[{pitch:62,start:.123,duration:1.375,velocity:.68},{pitch:65,start:2,duration:1,velocity:.75}],steps:Object.fromEntries(assistant.lanes.map(l=>[l,[]]))}]}]};
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(plan)}]}]})};
}});
ipcMain.handle('sonora:status',()=>({codex:{connected:true},api:true}));
ipcMain.handle('sonora:generate',(_event,request)=>{requests.push(structuredClone(request));return engine.generate(request);});
ipcMain.handle('sonora:cancel',()=>engine.cancel());
const api='window.sonoraVerification={getProject:()=>project,replaceProject:next=>restoreProjectSnapshot(JSON.stringify(next)),getHistory:()=>({undo:undoHistory.length,redo:redoHistory.length}),clearHistory:()=>{undoHistory.length=0;redoHistory.length=0;updateHistoryButtons();},undo,saveProject,storageKey:STORAGE_KEY,assistantOpen,assistantClose,assistantAnalyze,SYNTH_PRESETS};';
app.whenReady().then(async()=>{
  protocol.handle('sonora-test',request=>{
    const url=new URL(request.url),file=path.resolve(root,'.'+url.pathname);
    if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
    if(url.pathname==='/studio/')return new Response(fs.readFileSync(path.join(root,'studio/index.html'),'utf8').replace('    })();\n  </script>',api+'\n    })();\n  </script>'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
    return net.fetch(pathToFileURL(file).href);
  });
  window=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{preload:path.resolve(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  try{
    await window.loadURL('sonora-test://app/studio/');
    const result=await window.webContents.executeJavaScript(fs.readFileSync(path.resolve(__dirname,'../studio/sonora-assistant.test.js'),'utf8'),true);
    assert(Array.isArray(result)&&result.length>=6,'Assistant suite did not execute');
    assert.equal(requests.length,5,'Quick draft, scope refusal and explicit revision use one request each; fallback uses two');
    const first=requests[0];assert.equal(first.provider,'api');assert.equal(first.model,'gpt-6.1-sol');assert.equal(first.effort,'low');assert.equal(first.scope,'selected');
    assert.equal(first.context.editTarget.kind,'clip');assert.equal(first.context.creativeBrief.bars,8);assert.equal(first.context.creativeBrief.root,null);assert.equal(first.context.creativeBrief.tonality,'chromatic');assert.equal(first.context.creativeBrief.energy,'sparse');assert.equal(first.context.creativeBrief.development,'evolving');
    assert.equal(first.context.musicAnalysis,undefined,'Quick draft sends no audio measurements');assert.equal(first.context.previousDraft,undefined);assert(first.prompt.includes('4 bars'));assert(outputs[0].input[0].content.includes('free-text MUSIC REQUEST is authoritative'));
    assert.equal(requests[4].context.previousDraft.constraints.passage.endBeat,24);assert(outputs.every(o=>o.store===false&&!o.tools));
    result.forEach(line=>console.log('assistant: '+line));console.log('PASS native renderer → IPC → schema/scope checks, optional brief request contract and exactly bounded generation passes');
    clearTimeout(timer);app.exit(0);
  }catch(error){console.error(error.stack);clearTimeout(timer);app.exit(1);}
});
