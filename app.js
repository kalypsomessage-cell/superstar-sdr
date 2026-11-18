'use strict';
const BANDS=[{id:'80m',name:'80 m',hz:3700000,mode:'lsb'},{id:'40m',name:'40 m',hz:7150000,mode:'lsb'},{id:'20m',name:'20 m',hz:14250000,mode:'usb'},{id:'17m',name:'17 m',hz:18130000,mode:'usb'},{id:'15m',name:'15 m',hz:21300000,mode:'usb'},{id:'12m',name:'12 m',hz:24950000,mode:'usb'},{id:'10m',name:'10 m',hz:28500000,mode:'usb'}];
const KEY='superstar-mobile-v1';const DEFAULT_SERVER='http://22859.proxy.kiwisdr.com:8073/';
const $=id=>document.getElementById(id);
let settings={hz:7150000,mode:'lsb',server:DEFAULT_SERVER,memories:[]};
try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved && typeof saved==='object')settings={...settings,...saved}}catch(e){}
function safeHz(v){return Number.isFinite(v)&&v>=10000&&v<=30000000?v:null}
function format(hz){return(hz/1000000).toFixed(5)}
function status(s){$('status').textContent=s}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(settings))}catch(e){status('Stockage indisponible sur ce navigateur')}}
function sync(){ $('frequency').textContent=format(settings.hz);$('modeLabel').textContent=settings.mode.toUpperCase();$('mode').value=settings.mode.toUpperCase();$('manualFrequency').value=format(settings.hz);Array.from($('bands').children).forEach(el=>el.classList.toggle('active',el.dataset.band===settings.band));persist() }
function tune(hz,band=null){const valid=safeHz(Math.round(hz));if(valid===null){status('Fréquence hors plage 0,01–30 MHz');return false}settings.hz=valid;settings.band=band;sync();status(`Accord préparé : ${format(valid)} MHz ${settings.mode.toUpperCase()} · ouvrez ÉCOUTER`);return true}
for(const b of BANDS){const el=document.createElement('button');el.textContent=b.name;el.dataset.band=b.id;el.onclick=()=>{settings.mode=b.mode;tune(b.hz,b.id)};$('bands').append(el)}
$('mode').onchange=()=>{settings.mode=$('mode').value.toLowerCase();sync();status('Mode sélectionné : '+settings.mode.toUpperCase())};
Array.from(document.querySelectorAll('[data-step]')).forEach(el=>el.onclick=()=>tune(settings.hz+Number(el.dataset.step)));
$('apply').onclick=()=>tune(Number($('manualFrequency').value.replace(',','.'))*1000000);
$('server').value=settings.server||DEFAULT_SERVER;
$('server').onchange=()=>{settings.server=$('server').value.trim();persist()};
function cleanServer(value){let url;try{url=new URL(value.trim().includes('://')?value.trim():'http://'+value.trim())}catch(e){return null}if(!['http:','https:'].includes(url.protocol)||!url.hostname)return null;return url}
function receiverLink(){const base=cleanServer($('server').value);if(!base){status('Adresse KiwiSDR invalide');return null}settings.server=base.href;persist();const f=(settings.hz/1000).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');base.searchParams.set('f',f+(settings.mode==='nfm'?'nbfm':settings.mode));return base.href}
$('listen').onclick=()=>{const url=receiverLink();if(url){status('Ouverture du récepteur KiwiSDR (audio dans sa page)');const w=window.open(url,'_blank','noopener,noreferrer');if(!w)status('Ouverture bloquée : autorisez les fenêtres contextuelles dans Safari')}};
function renderMemories(){const el=$('memoryList');el.replaceChildren();if(!settings.memories.length){const p=document.createElement('p');p.className='subtle';p.textContent='Aucune mémoire pour le moment.';el.append(p);return}settings.memories.forEach((m,i)=>{const r=document.createElement('div');r.className='memory';const text=document.createElement('div');text.className='memText';const label=document.createElement('strong');label.textContent=`${format(m.hz)} MHz · ${m.mode.toUpperCase()}`;const details=document.createElement('small');details.textContent=m.server||'';text.append(label,details);const open=document.createElement('button');open.textContent='RAPPELER';open.onclick=()=>{settings.mode=m.mode;settings.server=m.server||DEFAULT_SERVER;$('server').value=settings.server;tune(m.hz);status('Mémoire rappelée : appuyez sur ÉCOUTER')};const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Effacer la mémoire');remove.onclick=()=>{settings.memories.splice(i,1);persist();renderMemories()};r.append(text,open,remove);el.append(r)})}
$('save').onclick=()=>{const base=cleanServer($('server').value);if(!base){status('Renseignez une adresse Kiwi valide');return}const m={hz:settings.hz,mode:settings.mode,server:base.origin+'/'};if(settings.memories.some(v=>v.hz===m.hz&&v.mode===m.mode&&v.server===m.server)){status('Déjà en mémoire');return}settings.memories.unshift(m);settings.memories=settings.memories.slice(0,80);persist();renderMemories();status('Fréquence mémorisée')};
if(!safeHz(settings.hz))settings.hz=7150000;if(!['am','lsb','usb','nbfm','nfm'].includes(settings.mode))settings.mode='lsb';sync();renderMemories();
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
