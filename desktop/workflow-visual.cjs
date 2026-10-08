'use strict';
// Own-app UI verification only. This fixture is excluded from packaged desktop files.
const {app,BrowserWindow,protocol,net}=require('electron'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
app.setPath('userData',path.resolve(__dirname,`../desktop-release/workflow-profile-${Date.now()}`));
protocol.registerSchemesAsPrivileged([{scheme:'sonora-workflow-test',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const root=path.resolve(__dirname,'../dist'),suite=fs.readFileSync(path.resolve(__dirname,'../studio/sonora-workflow.test.js'),'utf8'),shots=path.resolve(__dirname,'../screenshots');
const visualOnly=process.argv.includes('--visual-only');
fs.mkdirSync(shots,{recursive:true});
const timer=setTimeout(()=>{console.error('Workflow visual test timed out');app.exit(1);},40000);
app.whenReady().then(async()=>{
  protocol.handle('sonora-workflow-test',request=>{
    const url=new URL(request.url),file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
    if(url.pathname==='/studio/'){
      const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8').replace('    })();\n  </script>',`window.sonoraVerification={getProject:()=>project,getTrack,replaceProject:next=>restoreProjectSnapshot(JSON.stringify(next)),sessionStarter,saveProject,SYNTH_PRESETS,audio};\n    })();\n  </script>${visualOnly?'':`<script>window.workflowTestResult=${suite};</script>`}`);
      return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
    }
    return net.fetch(pathToFileURL(file).href);
  });
  const window=new BrowserWindow({show:false,width:1480,height:900,useContentSize:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const run=code=>window.webContents.executeJavaScript(code),wait=()=>new Promise(resolve=>setTimeout(resolve,180));
  const capture=async name=>{await wait();await window.webContents.capturePage();await new Promise(resolve=>setTimeout(resolve,500));fs.writeFileSync(path.join(shots,`${name}.png`),(await window.webContents.capturePage()).toPNG());console.log(`SCREENSHOT ${path.join(shots,`${name}.png`)}`);};
  try{
    await window.loadURL('sonora-workflow-test://app/studio/');if(!visualOnly){const results=await run('window.workflowTestResult');if(!Array.isArray(results)||results.length<20)throw Error('Workflow suite did not execute');results.forEach(line=>console.log(line));}
    await run('window.sonoraVerification.sessionStarter("empty")');
    for(const [width,height,label] of [[1480,900,'wide'],[1024,768,'laptop'],[900,640,'compact']]){
      window.setContentSize(width,height);await capture(`workflow-empty-${label}`);
      console.log('LAYOUT '+JSON.stringify(await run(`(()=>{const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:Math.round(r.left),top:Math.round(r.top),right:Math.round(r.right),bottom:Math.round(r.bottom)}};return {width:innerWidth,height:innerHeight,viewportOverflow:document.documentElement.scrollWidth-innerWidth,card:box('.workflow-empty-card'),timeline:box('.arrangement-pane'),context:box('#workflowContext'),toolbar:box('.viewbar')}})()`)));
      await run('window.SonoraWorkflow.openCommands("sounds","piano")');await capture(`workflow-commands-${label}`);await run('document.querySelector("#workflowCommandDialog").close()');
    }
    window.setContentSize(1024,768);await run('window.SonoraWorkflow.openTrackPicker()');await capture('workflow-add-track-laptop');
    clearTimeout(timer);app.exit(0);
  }catch(error){console.error(error.stack);clearTimeout(timer);app.exit(1);}
});
