'use strict';
const {app}=require('electron'),path=require('node:path'),assert=require('node:assert/strict');
app.setPath('userData',path.resolve(__dirname,`../desktop-release/apply-profile-${Date.now()}`));
const main=require('./main.cjs');let window;
main.engine.status=async()=>({connected:true,method:'test'});
main.engine.generate=async request=>{const change={action:'update',trackId:request.context.selectedTrack,name:null,instrument:'Studio Grand',volume:.5,pan:0,mute:false,effectPreset:null,parameters:[],clips:[{name:'Generated phrase',start:128,length:16,notes:[60,64,67,72].map((pitch,i)=>({pitch,start:i*2,duration:1.5,velocity:.7})),steps:Object.fromEntries(['kick','snare','hat','openHat','clap','tom','rim'].map(l=>[l,[]]))}]};return{summary:'Add a piano phrase later in the arrangement.',title:null,tempo:null,tracks:request.prompt==='many tracks'?Array.from({length:10},(_,i)=>({...structuredClone(change),action:'add',trackId:null,name:`Generated piano ${i+1}`})):[change]};};
const timeout=setTimeout(()=>{console.error('Apply regression timed out');app.exit(1);},30000);
const js=source=>window.webContents.executeJavaScript(source),wait=async source=>{for(let i=0;i<100;i++){if(await js(source))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out waiting for '+source);};
app.whenReady().then(async()=>{try{
  for(let i=0;i<100;i++){window=main.getWindow();if(window&&!window.webContents.isLoading())break;await new Promise(r=>setTimeout(r,100));}
  await js("document.querySelector('#assistantButton').click()");await wait("document.querySelector('#assistantConnectionState').textContent==='Connected'");
  await js("document.querySelector('#assistantAnalyzeAudio').checked=false;document.querySelector('#assistantPrompt').value='Write a piano phrase';document.querySelector('#assistantForm').requestSubmit()");await wait("document.querySelector('#assistantStatus').textContent.startsWith('Ready to review')");
  await js("document.querySelector('#assistantClose').click();document.querySelector('#zoomOut').click();document.querySelector('#assistantButton').click()");
  await js("[...document.querySelectorAll('#assistantResult button')].find(b=>b.textContent==='Apply to session').click()");
  const state=await js("({clips:document.querySelectorAll('#arrangementGrid .clip').length,open:document.querySelector('#assistantDialog').open,status:document.querySelector('#assistantStatus').textContent})");
  assert.equal(state.clips,1,'Apply after changing only zoom must insert the clip; status: '+state.status);assert.equal(state.open,false,'Apply must reveal the timeline');
  const visible=await js("(()=>{const c=document.querySelector('#arrangementGrid .clip').getBoundingClientRect(),p=document.querySelector('.arrangement-pane').getBoundingClientRect();return c.left>=p.left&&c.left<p.right&&c.top>=p.top&&c.bottom<=p.bottom})()");assert(visible,'Generated clip must be visible even when placed at beat 128');
  const saved=await js("JSON.parse(localStorage.getItem('sonora-daw-project-v1'))");assert.equal(saved.tracks[0].clips[0].notes.length,4);assert.equal(saved.tracks[0].clips[0].start,128);
  await js("document.querySelector('#undoButton').click()");assert.equal(await js("document.querySelectorAll('#arrangementGrid .clip').length"),0);
  console.log('PASS real Apply click after view changes, distant generated clip visibility, MIDI persistence and one-step Undo');
  await js("document.querySelector('#assistantButton').click();document.querySelector('#assistantPrompt').value='many tracks';document.querySelector('#assistantForm').requestSubmit()");await wait("document.querySelector('#assistantStatus').textContent.startsWith('Ready to review')");await js("document.querySelector('#assistantApply').click()");
  assert.equal(await js("document.querySelectorAll('#arrangementGrid .clip').length"),10);
  assert(await js("(()=>{const c=document.querySelector('#arrangementGrid .clip.selected').getBoundingClientRect(),p=document.querySelector('.arrangement-pane').getBoundingClientRect();return c.left>=p.left&&c.right<=p.right&&c.top>=p.top+70&&c.bottom<=p.bottom})()"),'A newly added track below the viewport must be revealed');
  await js("document.querySelector('#undoButton').click()");assert.equal(await js("document.querySelectorAll('#arrangementGrid .clip').length"),0);console.log('PASS multi-track Apply reveals the selected generated track below the viewport and undoes as a single edit');
  // Musical edits still protect the session and expose an error beside Apply.
  await js("document.querySelector('#assistantButton').click();document.querySelector('#assistantPrompt').value='Write a piano phrase';document.querySelector('#assistantForm').requestSubmit()");await wait("document.querySelector('#assistantStatus').textContent.startsWith('Ready to review')");
  await js("document.querySelector('#assistantClose').click();const t=document.querySelector('#tempoInput');t.value='133';t.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#assistantButton').click();document.querySelector('#assistantApply').click()");
  const rejection=await js("({open:document.querySelector('#assistantDialog').open,clips:document.querySelectorAll('#arrangementGrid .clip').length,error:document.querySelector('#assistantApplyError').textContent,hidden:document.querySelector('#assistantApplyError').hidden})");assert(rejection.open);assert.equal(rejection.clips,0);assert(rejection.error.includes('session changed'));assert.equal(rejection.hidden,false);
  console.log('PASS stale musical edits remain protected with a visible Apply error');clearTimeout(timeout);app.exit(0);
}catch(error){console.error(error.stack);clearTimeout(timeout);app.exit(1);}});
