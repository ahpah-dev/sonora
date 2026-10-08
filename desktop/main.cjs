'use strict';
const {app,BrowserWindow,protocol,net,ipcMain,shell,session,safeStorage,Menu}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {makeEngine}=require('./engine.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'sonora',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const base=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'..');
const assistant=require(path.join(base,'shared/assistant.js'));
const binary=app.isPackaged?path.join(base,'codex/x86_64-pc-windows-msvc/bin/codex.exe'):path.join(__dirname,'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
const studioRoot=app.isPackaged?path.join(base,'studio'):path.join(base,'dist');
let window,loginUrl=null;const engine=makeEngine({binary,assistant,readApiKey:()=>{try{return safeStorage.decryptString(fs.readFileSync(path.join(app.getPath('userData'),'openai-key.bin')));}catch{return null;}},notify:event=>{if(event.kind==='login')loginUrl=event.url;if(window&&!window.isDestroyed())window.webContents.send('sonora:event',event);}});
function trusted(event){if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!=='sonora://app/studio/')throw Error('This request is not from Sonora');}
function handler(channel,fn){ipcMain.handle(channel,async(event,...args)=>{trusted(event);return fn(...args);});}
handler('sonora:status',async()=>({codex:await engine.status(),api:fs.existsSync(path.join(app.getPath('userData'),'openai-key.bin')),version:app.getVersion()}));
handler('sonora:connect',()=>engine.login());handler('sonora:generate',request=>engine.generate(request));handler('sonora:cancel',()=>engine.cancel());
handler('sonora:open-login',async()=>{if(loginUrl&&new URL(loginUrl).origin==='https://auth.openai.com')await shell.openExternal(loginUrl);});
handler('sonora:api-key',async key=>{if(typeof key!=='string'||!/^sk-[a-zA-Z0-9_-]{20,300}$/.test(key.trim()))throw Error('Enter a valid OpenAI API key');if(!safeStorage.isEncryptionAvailable())throw Error('Secure credential storage is unavailable on this device');const response=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key.trim()}`},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('The API key could not be verified. Check the key and network connection.');fs.writeFileSync(path.join(app.getPath('userData'),'openai-key.bin'),safeStorage.encryptString(key.trim()));return {connected:true};});
handler('sonora:api-disconnect',()=>{fs.rmSync(path.join(app.getPath('userData'),'openai-key.bin'),{force:true});return true;});
app.whenReady().then(async()=>{
  protocol.handle('sonora',async request=>{const url=new URL(request.url);if(url.hostname!=='app')return new Response('Not found',{status:404});let file;try{file=path.resolve(studioRoot,'.'+decodeURIComponent(url.pathname));}catch{return new Response('Bad request',{status:400});}if(file!==studioRoot&&!file.startsWith(studioRoot+path.sep))return new Response('Forbidden',{status:403});if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');return net.fetch(pathToFileURL(file).href);});
  session.defaultSession.webRequest.onHeadersReceived((details,callback)=>{callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'"]}});});
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===window?.webContents&&contents.getURL()==='sonora://app/studio/'&&['media','midi','midiSysex'].includes(permission)));
  session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===window?.webContents&&['media','midi','midiSysex'].includes(permission));
  window=new BrowserWindow({show:!(!app.isPackaged&&process.argv.includes('--smoke-test')),width:1480,height:960,minWidth:920,minHeight:640,title:'Sonora',titleBarStyle:'hidden',titleBarOverlay:{color:'#101419',symbolColor:'#a0acb9',height:34},autoHideMenuBar:true,backgroundColor:'#101419',icon:path.join(app.isPackaged?base:__dirname,'icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Sonora',submenu:[{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));
  function external(value){try{const url=new URL(value);if(url.protocol==='https:'&&['sonoradaw.vercel.app','github.com','developers.openai.com','learn.chatgpt.com'].includes(url.hostname))shell.openExternal(url.href);}catch{}}
  window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});window.webContents.on('will-navigate',(event,url)=>{if(url!=='sonora://app/studio/'){event.preventDefault();external(url);}});
  await window.loadURL('sonora://app/studio/');
});
app.on('before-quit',()=>engine.cancel());app.on('window-all-closed',()=>app.quit());
module.exports={engine,getWindow:()=>window};
