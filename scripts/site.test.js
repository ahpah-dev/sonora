(async()=>{
  const q=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
  const check=(ok,label)=>{if(!ok)throw Error(label);results.push('PASS '+label);};
  q('#sounds').scrollIntoView({block:'center',behavior:'instant'});await sleep(200);
  check(document.querySelectorAll('.demo-keys button').length===25,'listening room offers two chromatic octaves');
  const key=(code,on=true)=>window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}));
  key('KeyZ');key('KeyX');await sleep(80);check(document.querySelectorAll('.demo-keys [aria-pressed=true]').length===2&&q('#demoStatus').textContent.includes('TOUCH'),'keyboard input plays simultaneous piano voices');key('KeyZ',false);key('KeyX',false);check(!q('.demo-keys [aria-pressed=true]'),'key release clears pressed states');
  key('ShiftLeft');check(q('#demoSustain').getAttribute('aria-pressed')==='true','keyboard sustain pedal activates');key('ShiftLeft',false);check(q('#demoSustain').getAttribute('aria-pressed')==='false','keyboard sustain pedal releases');
  q('[data-sound=upright]').click();check(q('#soundName').textContent==='Mellow Upright'&&q('[data-sound=upright]').getAttribute('aria-pressed')==='true','piano selection updates sound and accessible state');
  q('#demoPlay').click();await sleep(150);check(q('#demoPlay').getAttribute('aria-pressed')==='true','inspiration sequence starts');q('#demoPlay').click();check(q('#demoPlay').getAttribute('aria-pressed')==='false'&&!q('.demo-flash'),'sequence stops and clears queued highlights');
  for(const view of ['perform','shape','compose']){q(`[data-view=${view}]`).click();await q('#studioPreview').decode();check(q('#studioPreview').naturalWidth===1600,`${view} preview loads actual studio screenshot`);}
  check(document.documentElement.scrollWidth<=innerWidth,'page stays within viewport width');
  return results;
})();
