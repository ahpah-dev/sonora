'use strict';
const {app,BrowserWindow,protocol,net}=require('electron'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
app.setPath('userData',path.resolve(__dirname,`../desktop-release/timeline-profile-${Date.now()}`));
protocol.registerSchemesAsPrivileged([{scheme:'sonora-test',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const root=path.resolve(__dirname,'../dist'),suite=fs.readFileSync(path.resolve(__dirname,'../studio/sonora-timeline.test.js'),'utf8');
const timer=setTimeout(()=>{console.error('Timeline test timed out');app.exit(1);},30000);
app.whenReady().then(async()=>{
  protocol.handle('sonora-test',request=>{
    const url=new URL(request.url),file=path.resolve(root,'.'+url.pathname);
    if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
    if(url.pathname==='/studio/'){
      const html=fs.readFileSync(path.join(root,'studio/index.html'),'utf8').replace('    })();\n  </script>',`window.sonoraVerification={getProject:()=>project,replaceProject:next=>restoreProjectSnapshot(JSON.stringify(next)),audio};\n    })();\n  </script><script>window.timelineTestResult=${suite};</script>`);
      return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
    }
    return net.fetch(pathToFileURL(file).href);
  });
  const window=new BrowserWindow({show:false,width:1280,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  try{await window.loadURL('sonora-test://app/studio/');const result=await window.webContents.executeJavaScript('window.timelineTestResult');if(!Array.isArray(result)||result.length<20)throw Error('Timeline suite did not execute');result.forEach(line=>console.log(line));clearTimeout(timer);app.exit(0);}catch(error){console.error(error.stack);clearTimeout(timer);app.exit(1);}
});
