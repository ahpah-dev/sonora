const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('sonoraDesktop',{
  status:()=>ipcRenderer.invoke('sonora:status'),
  connect:()=>ipcRenderer.invoke('sonora:connect'),
  setApiKey:key=>ipcRenderer.invoke('sonora:api-key',key),
  disconnectApi:()=>ipcRenderer.invoke('sonora:api-disconnect'),
  generate:request=>ipcRenderer.invoke('sonora:generate',request),
  cancel:()=>ipcRenderer.invoke('sonora:cancel'),
  openLogin:()=>ipcRenderer.invoke('sonora:open-login'),
  onEvent:callback=>{const listener=(_,event)=>callback(event);ipcRenderer.on('sonora:event',listener);return ()=>ipcRenderer.removeListener('sonora:event',listener);}
});
