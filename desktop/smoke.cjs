const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// Isolated, hidden application smoke test: no credentials are copied or printed.
app.setPath('userData',path.resolve(__dirname,`../desktop-release/smoke-profile-${Date.now()}`));
const main=require('./main.cjs');
const timer=setTimeout(()=>{console.error('Desktop startup timed out');app.exit(1);},30000);
app.whenReady().then(()=>{const poll=setInterval(async()=>{const window=main.getWindow();if(!window||window.webContents.isLoading())return;clearInterval(poll);try{
  const result=await window.webContents.executeJavaScript(`(async()=>({url:location.href,bridge:typeof window.sonoraDesktop,modelOptions:[...document.querySelectorAll('#assistantModel option')].map(o=>o.value),pitches:document.querySelectorAll('.pro-pitch-key').length,assistant:!!document.querySelector('#assistantButton'),title:document.querySelector('#projectTitle').value,clips:document.querySelectorAll('#arrangementGrid .clip').length,titlebar:getComputedStyle(document.querySelector('.desktop-titlebar')).webkitAppRegion,appBottom:document.querySelector('.app').getBoundingClientRect().bottom,height:innerHeight,piano:(await (await fetch('../assets/piano/index.json')).json()),status:await window.sonoraDesktop.status()}))()`);
  assert.equal(result.url,'sonora://app/studio/');assert.equal(result.bridge,'object');assert(result.assistant);assert.deepEqual(result.modelOptions,['gpt-6.1-sol','gpt-6-astra','gpt-6-luna']);assert(result.piano);assert.equal(typeof result.status.codex.connected,'boolean');
  assert.equal(result.title,'Untitled session');assert.equal(result.clips,0);assert.equal(result.titlebar,'drag');assert.equal(result.appBottom,result.height);assert.equal(window.isMenuBarVisible(),false);
  const image=await window.webContents.capturePage();fs.mkdirSync(path.resolve(__dirname,'../screenshots'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../screenshots/sonora-desktop-fresh.png'),image.toPNG());
  console.log('PASS hidden Electron startup, secure protocol, assistant bridge, offline piano, empty arrangement, draggable title bar, hidden menu and window-fit layout');clearTimeout(timer);app.exit(0);
}catch(error){console.error(error.message);clearTimeout(timer);app.exit(1);}},100);});
