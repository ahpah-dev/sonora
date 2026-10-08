'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
function makeEngine({binary,assistant,notify=()=>{},readApiKey=()=>null,fetchImpl=fetch}){
  let active=null;
  const configuration=['--ignore-user-config','--ignore-rules','-c','approval_policy="never"','-c','web_search="disabled"','-c','features.shell_tool=false','-c','features.plugins=false','-c','features.apps=false','-c','features.multi_agent=false','-c','features.computer_use=false','-c','features.image_generation=false','-c','features.code_mode_host=false','-c','mcp_servers={}'];
  function child(args,options={}){return spawn(binary,args,{windowsHide:true,stdio:['pipe','pipe','pipe'],...options});}
  async function status(){try{return await new Promise(resolve=>{const process=child(['login','status']);let text='';const timer=setTimeout(()=>{process.kill();resolve({connected:false});},10000);process.stdout.on('data',b=>text+=b);process.stderr.on('data',b=>text+=b);process.on('error',()=>{clearTimeout(timer);resolve({connected:false});});process.on('close',code=>{clearTimeout(timer);resolve({connected:code===0&&/logged in/i.test(text),method:/ChatGPT/i.test(text)?'ChatGPT':'Codex'});});});}catch{return {connected:false};}}
  function cancel(){if(active){active.cancelled=true;active.child?.kill();active.controller?.abort();return true;}return false;}
  async function login(){
    if(active)throw Error('Finish or cancel the current request first');const job={cancelled:false};active=job;
    try{return await new Promise((resolve,reject)=>{const process=job.child=child(['login','--device-auth']);let output='';
      const timer=setTimeout(()=>{process.kill();reject(Error('Sign-in timed out. Try connecting again.'));},300000);
      const update=b=>{output=(output+b.toString()).slice(-12000);const url=output.match(/https:\/\/auth\.openai\.com\/[a-z0-9/_-]+/i)?.[0],code=output.replace(/\x1b\[[0-9;]*m/g,'').match(/\b[A-Z0-9]{4,5}-[A-Z0-9]{4,5}\b/)?.[0];if(url&&code)notify({kind:'login',url,code});};
      process.stdout.on('data',update);process.stderr.on('data',update);process.on('error',()=>{clearTimeout(timer);reject(Error('Bundled Codex could not start. Download the latest Sonora build.'));});
      process.on('close',code=>{clearTimeout(timer);if(job.cancelled)reject(Error('Sign-in cancelled'));else if(code!==0)reject(Error('Codex sign-in failed. Enable device-code sign-in in ChatGPT settings, then try again.'));else resolve({connected:true,method:'ChatGPT'});});
    });}finally{if(active===job)active=null;}
  }
  function checkScope(plan,request){
    if(assistant.checkScope)return assistant.checkScope(plan,request);
    if(request.scope==='add'&&(plan.title!==null||plan.tempo!==null||plan.tracks.some(t=>t.action!=='add')))throw Error('The proposal went beyond adding tracks. Try again.');
    if(request.scope==='selected'&&(plan.title!==null||plan.tempo!==null||plan.tracks.some(t=>t.action!=='update'||t.trackId!==request.context.selectedTrack)))throw Error('The proposal changed more than the selected track. Try again.');
    return plan;
  }
  async function generate(request){
    if(active)throw Error('A request is already running');
    if(!request||!['codex','api'].includes(request.provider))throw Error('Choose Codex or OpenAI API');
    const input=assistant.prompt(request);const job={cancelled:false};active=job;let folder;
    let lastPhase='',lastOutputAt=0;
    const progress=(phase,message,characters)=>{if(job.cancelled)return;const now=Date.now();if(phase===lastPhase&&characters!==undefined&&now-lastOutputAt<250)return;lastPhase=phase;lastOutputAt=now;notify({kind:'progress',phase,message,...(characters===undefined?{}:{characters})});};
    progress('connecting','Connecting to OpenAI…');
    try{
      let raw;
      if(request.provider==='api'){
        const key=readApiKey();if(!key)throw Error('Connect your OpenAI API key first');
        const controller=job.controller=new AbortController(),timer=setTimeout(()=>controller.abort(),600000);
        try{
          const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model:request.model,reasoning:{effort:request.effort},input:[{role:'user',content:input}],store:false,stream:true,max_output_tokens:20000,text:{format:{type:'json_schema',name:'sonora_music_proposal',strict:true,schema:assistant.schema}}})});
          if(!response.ok){if(response.status===401)throw Error('The API key was rejected. Reconnect with a valid OpenAI API key.');if(response.status===429)throw Error('OpenAI usage or rate limit reached. Check your API billing and try again.');if(response.status===403||response.status===404)throw Error('This account cannot use the selected model. Choose another GPT-6 or GPT-6.1 model.');throw Error(`OpenAI request failed (${response.status}). Try again.`);}
          let data;
          if(response.headers?.get('content-type')?.includes('text/event-stream')){
            const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',characters=0,total=0;
            function eventFrame(frame){const payload=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!payload||payload==='[DONE]')return;const event=JSON.parse(payload);
              if(event.type==='response.created'||event.type==='response.in_progress')progress('composing','Composing your music…');
              else if(event.type==='response.output_text.delta'){characters+=typeof event.delta==='string'?event.delta.length:0;progress('writing','Writing notes, clips and instrument settings…',characters);}
              else if(event.type==='response.completed'||event.type==='response.incomplete')data=event.response;
              else if(event.type==='response.failed'||event.type==='error')throw Error('OpenAI could not complete the proposal. Check your account limits or try a smaller request.');
            }
            try{while(true){const {done,value}=await reader.read();if(job.cancelled)throw Error('Request cancelled');if(done){pending+=decoder.decode();break;}total+=value.length;if(total>8000000)throw Error('The assistant response was too large');pending+=decoder.decode(value,{stream:true});let match;while((match=/\r?\n\r?\n/.exec(pending))){eventFrame(pending.slice(0,match.index));pending=pending.slice(match.index+match[0].length);}}if(pending.trim())eventFrame(pending);}
            finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
          }else data=await response.json();
          if(data?.status!=='completed')throw Error('OpenAI did not finish the proposal. Try a smaller request or lower reasoning effort.');
          const text=data.output?.flatMap(item=>item.type==='message'?item.content||[]:[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');if(!text)throw Error('The assistant could not provide a music proposal');raw=JSON.parse(text);
        }finally{clearTimeout(timer);}
      }else{
        progress('connecting','Checking your Codex connection…');if(!(await status()).connected)throw Error('Connect Codex with your ChatGPT account first');if(job.cancelled)throw Error('Request cancelled');
        folder=await fs.mkdtemp(path.join(os.tmpdir(),'sonora-music-'));const schemaPath=path.join(folder,'proposal.schema.json'),outputPath=path.join(folder,'proposal.json');await fs.writeFile(schemaPath,JSON.stringify(assistant.schema));
        if(job.cancelled)throw Error('Request cancelled');await new Promise((resolve,reject)=>{
          const process=job.child=child(['exec',...configuration,'--ephemeral','--skip-git-repo-check','--sandbox','read-only','--json','--color','never','--model',request.model,'-c',`model_reasoning_effort="${request.effort}"`,'--output-schema',schemaPath,'--output-last-message',outputPath,'--cd',folder,'-'],{cwd:folder});
          let pending='',errorText='';const timer=setTimeout(()=>{process.kill();reject(Error('The request timed out. Try fewer bars or lower reasoning effort.'));},600000);
          process.stdout.on('data',bytes=>{pending+=bytes.toString();if(pending.length>2000000){process.kill();reject(Error('The assistant response was too large'));return;}let split;while((split=pending.indexOf('\n'))>=0){const line=pending.slice(0,split);pending=pending.slice(split+1);try{const event=JSON.parse(line);if(event.type==='thread.started')progress('waiting','Codex connected · waiting for generation to start…');if(event.type==='turn.started')progress('composing','Composing your music…');if(event.type==='item.started'&&event.item?.type==='agent_message')progress('writing','Writing notes, clips and instrument settings…');if(event.type==='item.completed'&&event.item?.type==='agent_message')progress('writing','Music proposal received…',event.item.text?.length||0);if(event.type==='error'||event.type==='turn.failed')errorText=event.message||event.error?.message||'Codex request failed';}catch{}}});
          process.stderr.on('data',b=>{errorText=(errorText+b.toString()).slice(-12000);});
          process.on('error',()=>{clearTimeout(timer);reject(Error('Bundled Codex could not start. Download the latest Sonora build.'));});
          process.on('close',code=>{clearTimeout(timer);if(job.cancelled)reject(Error('Request cancelled'));else if(code!==0){const unavailable=/model.*(support|available|access|not found)/i.test(errorText);reject(Error(unavailable?'This account cannot use the selected model. Choose another GPT-6 or GPT-6.1 model.':'Codex could not complete the request. Check your account limits or reconnect and try again.'));}else resolve();});
          process.stdin.on('error',()=>{});process.stdin.end(input);
        });
        const result=await fs.readFile(outputPath,'utf8');if(result.length>1000000)throw Error('The proposal was too large');raw=JSON.parse(result);
      }
      if(job.cancelled)throw Error('Request cancelled');
      progress('validating','Checking note ranges, instruments and edit scope…');
      const plan=checkScope(assistant.validatePlan(raw,request.context.catalog,request.context),request);progress('complete','Your proposal is ready to review.');return plan;
    }catch(error){if(job.cancelled)throw Error('Request cancelled');if(error.name==='AbortError')throw Error('Request timed out. Try a smaller request.');if(error instanceof SyntaxError)throw Error('The assistant returned an incomplete proposal. Try again.');throw error;}
    finally{if(folder)await fs.rm(folder,{recursive:true,force:true});if(active===job)active=null;}
  }
  return {status,login,generate,cancel};
}
module.exports={makeEngine};
