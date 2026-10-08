'use strict';
// Exercise the actual production renderer and offline audio, in a disposable session.
const {app,BrowserWindow,protocol,net}=require('electron'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
app.setPath('userData',path.resolve(__dirname,`../desktop-release/studio-profile-${Date.now()}`));
protocol.registerSchemesAsPrivileged([{scheme:'sonora-test',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const root=path.resolve(__dirname,'../dist'),names=process.argv.filter(arg=>arg.startsWith('--suite=')).map(arg=>arg.slice(8)),suites=names.length?names:['workflow','session','audio','acoustic','editor'];
const api='window.sonoraVerification={sessionWav,sessionRange,sessionPosition,sessionLoopClip,sessionStarter,sessionRenderWav,collectEvents,scheduler,audio,getProject:()=>project,replaceProject:next=>restoreProjectSnapshot(JSON.stringify(next)),getTrack,saveProject,notesForClip,pianoBank,pianoWarmNotes,pianoSamplesFor,pianoVelocityMix,pianoTouch,SYNTH_PRESETS,PIANO_PRESETS,proVoice,proDrumVoice,proSynth,liveNoteDown,liveNoteUp,selectedNotes,acousticWarmTrack,acousticWarmProject,acousticSamplesFor,acousticNeedsSamples,acousticBuffers,ACOUSTIC_PRESETS};';
const timer=setTimeout(()=>{console.error('Studio audio/workflow test timed out');app.exit(1);},120000);
app.whenReady().then(async()=>{
  protocol.handle('sonora-test',request=>{
    const url=new URL(request.url),file=path.resolve(root,'.'+url.pathname);
    if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
    if(url.pathname==='/studio/')return new Response(fs.readFileSync(path.join(root,'studio/index.html'),'utf8').replace('    })();\n  </script>',api+'\n    })();\n  </script>'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
    return net.fetch(pathToFileURL(file).href);
  });
  const window=new BrowserWindow({show:false,width:1480,height:950,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  try{
    await window.loadURL('sonora-test://app/studio/');
    for(const name of suites){
      if(!['editor','session','workflow','audio','acoustic'].includes(name))throw Error('Unknown suite');
      const result=await window.webContents.executeJavaScript(fs.readFileSync(path.resolve(__dirname,`../studio/sonora-${name}.test.js`),'utf8'),true);
      if(!Array.isArray(result)||result.length<5)throw Error(`${name} suite did not execute`);
      result.forEach(line=>console.log(`${name}: ${line}`));
    }
    clearTimeout(timer);app.exit(0);
  }catch(error){console.error(error.stack);clearTimeout(timer);app.exit(1);}
});
