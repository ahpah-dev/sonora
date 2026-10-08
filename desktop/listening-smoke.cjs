'use strict';
const {app}=require('electron'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
app.setPath('userData',path.resolve(__dirname,`../desktop-release/listening-profile-${Date.now()}`));
const main=require('./main.cjs');let calls=0,step=0,busy=false;
const proposal={summary:'Four-note C-major piano phrase.',title:null,tempo:null,tracks:[{action:'add',trackId:null,name:'Piano phrase',instrument:'Studio Grand',volume:.5,pan:0,mute:false,effectPreset:null,parameters:[],clips:[{name:'Phrase',start:0,length:16,notes:[60,64,67,72].map((pitch,i)=>({pitch,start:i*2,duration:1.5,velocity:.7})),steps:Object.fromEntries(['kick','snare','hat','openHat','clap','tom','rim'].map(l=>[l,[]]))}]}]};
// Stub only the remote provider. Use the real IPC, renderer, bundled piano,
// offline render, signal analysis, review, revision, apply and undo paths.
main.engine.status=async()=>({connected:true,method:'test'});
main.engine.generate=async request=>{calls++;assert.equal(request.model,'gpt-6.1-sol');assert(request.context.musicAnalysis);assert(!JSON.stringify(request).includes('base64'));assert(!('preview' in request.context.musicAnalysis));if(calls===2){assert(request.context.previousDraft.measurements.audio.peakDbfs>-100);assert.equal(request.context.previousDraft.proposal.tracks[0].clips[0].notes.length,4);}if(calls===3){assert(request.context.musicAnalysis.audio.peakDbfs>-100);assert.equal(request.context.musicAnalysis.structure.scheduledEvents,4);fs.mkdirSync(path.resolve(__dirname,'../screenshots'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../screenshots/listening-test-context.json'),JSON.stringify(request));}return structuredClone(proposal);};
const timeout=setTimeout(()=>{console.error('Local music analysis startup timed out');app.exit(1);},90000);
app.whenReady().then(()=>{const poll=setInterval(async()=>{if(busy)return;const window=main.getWindow();if(!window||window.webContents.isLoading())return;busy=true;
  try{
    if(step===0){await window.webContents.executeJavaScript("document.querySelector('#assistantButton').click()");step=1;}
    else if(step===1){if(await window.webContents.executeJavaScript("document.querySelector('#assistantConnectionState').textContent==='Connected'")){await window.webContents.executeJavaScript("document.querySelector('#assistantPrompt').value='Add a piano phrase';document.querySelector('#assistantForm').requestSubmit()");step=2;}}
    else if(step===2||step===3||step===4){const state=await window.webContents.executeJavaScript("({ready:document.querySelector('#assistantStatus').textContent.startsWith('Ready to review'),quality:document.querySelector('#assistantQuality')?.textContent,preview:document.querySelector('#assistantQuality audio')?.src,clips:document.querySelectorAll('#arrangementGrid .clip').length})");if(!state.ready)return;
      assert(state.quality?.includes('Peak'));assert(state.preview?.startsWith('blob:'));assert(!state.quality.includes('nearly silent'));
      if(step===2){assert.equal(state.clips,0);await window.webContents.executeJavaScript("document.querySelector('#assistantRefine').click()");step=3;}
      else if(step===3){assert.equal(calls,2);assert.equal(state.clips,0);await window.webContents.executeJavaScript("[...document.querySelectorAll('#assistantResult button')].find(b=>b.textContent==='Apply to session').click()");assert.equal(await window.webContents.executeJavaScript("document.querySelector('#assistantRefine').disabled"),true);await window.webContents.executeJavaScript("document.querySelector('#assistantForm').requestSubmit()");step=4;}
      else{assert.equal(calls,3);assert.equal(state.clips,1);await window.webContents.executeJavaScript("document.querySelector('#assistantClose').click();document.querySelector('#undoButton').click()");assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('#arrangementGrid .clip').length"),0);console.log('PASS actual piano PCM render, non-silent preview, before/after analysis, GPT-6.1 measurement context, feedback revision, unchanged review, apply and undo');clearInterval(poll);clearTimeout(timeout);app.exit(0);}
    }
  }catch(error){console.error(error.message);clearInterval(poll);clearTimeout(timeout);app.exit(1);}finally{busy=false;}
},200);});
