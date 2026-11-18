'use strict';
const BANDS=[
{id:'80m',label:'80 m',hz:3700000,mode:'lsb',start:3650000,end:3700000},
{id:'40m',label:'40 m',hz:7150000,mode:'lsb',start:7100000,end:7200000},
{id:'20m',label:'20 m',hz:14250000,mode:'usb',start:14125000,end:14300000},
{id:'17m',label:'17 m',hz:18130000,mode:'usb',start:18120000,end:18165000},
{id:'15m',label:'15 m',hz:21300000,mode:'usb',start:21200000,end:21450000},
{id:'12m',label:'12 m',hz:24950000,mode:'usb',start:24930000,end:24990000},
{id:'10m',label:'10 m',hz:28500000,mode:'usb',start:28300000,end:29000000}];
const RECEIVERS=[{id:'original',label:'🌍 Récepteur actuel',url:'http://22859.proxy.kiwisdr.com:8073/'},{id:'paris',label:'🇫🇷 Paris / Yvelines · F1UBL',url:'http://f1ubl.ddns.net:8072/'}];
const KEY='superstar-mobile-v1', DEFAULT='http://22859.proxy.kiwisdr.com:8073/', DEFAULT_RELAY='https://superstar-sdr-relay.kalypso-message.workers.dev';
const $=id=>document.getElementById(id);
const format=hz=>(hz/1e6).toFixed(5);
const safeHz=hz=>Number.isFinite(hz)&&hz>=10000&&hz<=30000000;
let settings={hz:7150000,mode:'lsb',band:'40m',server:DEFAULT,relay:DEFAULT_RELAY,volume:70,squelch:-105,memories:[],scanSpeed:'normal',receiverId:'original'};
try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object')settings={...settings,...saved}}catch(_){}
if(!safeHz(settings.hz))settings.hz=7150000;
if(!['am','lsb','usb','nbfm','nfm'].includes(settings.mode))settings.mode='lsb';
if(!SuperstarKiwi.parseServer(settings.server))settings.server=DEFAULT;
if(!settings.relay || !SuperstarKiwi.audioRelayUrl(settings.relay,1234))settings.relay=DEFAULT_RELAY;
if(!['normal','fast'].includes(settings.scanSpeed))settings.scanSpeed='normal';
if(!RECEIVERS.some(r=>r.id===settings.receiverId)){settings.receiverId='original';settings.server=DEFAULT;settings.relay=DEFAULT_RELAY;}
if(!Array.isArray(settings.memories))settings.memories=[];
settings.memories=settings.memories.filter(m=>safeHz(m.hz)&&['am','lsb','usb','nbfm','nfm'].includes(m.mode)).slice(0,120);
const radio=new SuperstarKiwi.KiwiAudio({state:onRadioState,meter:onMeter,tuned:()=>{syncDisplay();},});
let lastDb=-100;let radioConnected=false;let scan=null;let liveMode='offline';let manualEditing=false;
function status(s){$('status').textContent=s}
function connection(s,bad=false,ok=false){$('connection').textContent=s;$('connection').classList.toggle('bad',bad);$('connection').classList.toggle('ok',ok)}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(settings))}catch(_){status('Attention : sauvegarde locale indisponible')}}
function syncDisplay(){
 $('frequency').textContent=format(settings.hz);$('modeLabel').textContent=settings.mode.toUpperCase();
 $('mode').value=settings.mode==='nfm'?'nbfm':settings.mode;
 if(!manualEditing)$('manualFrequency').value=format(settings.hz).replace('.',',');
 $('displayState').textContent=liveMode==='audio'?'ÉCOUTE':liveMode==='socket'?'EN ATTENTE':'PRÉRÉGLAGE';
 for(const btn of $('bands').children)btn.classList.toggle('active',btn.dataset.band===settings.band);
 persist();updateScanPanel(scan?(scan.state==='running'?'BALAYAGE':scan.state==='listening'?'ÉCOUTE':'PAUSE'):'PRÊT')
}
function scanStop(message='Scan arrêté'){if(scan){clearTimeout(scan.timer);scan=null}if($('cbScanStop'))$('cbScanStop').disabled=true;if($('cbScan'))$('cbScan').disabled=false;if($('cbScanState'))$('cbScanState').textContent='PRÊT';for(const id of ['pauseScan','resumeScan','stopScan'])$(id).disabled=true;status(message);$('scanInfo').textContent='Détection d’activité radio, pas de reconnaissance de voix ou de langue.';updateScanPanel('ARRÊTÉ')}
function updateScanPanel(state){if($('cbScanState')&&scan&&scan.name==='cb')$('cbScanState').textContent=state;if($('scanFrequency'))$('scanFrequency').textContent=format(settings.hz)+' MHz · '+settings.mode.toUpperCase();if($('scanState'))$('scanState').textContent=state}
function tune(hz,band=null){hz=Math.round(hz);if(!safeHz(hz)){status('Fréquence hors plage 0,01–30 MHz');return false}
 if(scan){scanStop('Scan arrêté pour réglage fin · écoute maintenue')}
 if(radioConnected&&!radio.tune(hz,settings.mode)){status('Impossible d’envoyer l’accord au récepteur');return false}
 settings.hz=hz;settings.band=band;syncDisplay();status(`${radioConnected?'Accord envoyé':'Accord préparé'} : ${format(hz)} MHz ${settings.mode.toUpperCase()}`);return true}
function changeMode(mode){if(!['am','lsb','usb','nbfm'].includes(mode))return;const prev=settings.mode;settings.mode=mode;if(radioConnected&&!radio.tune(settings.hz,mode)){settings.mode=prev;status('Commande de modulation refusée');return}syncDisplay();status(`Modulation ${mode.toUpperCase()} ${radioConnected?'commandée':'préparée'}`)}
function onRadioState(state,detail){liveMode=state;radioConnected=state==='audio'||state==='waiting'||state==='socket';if(state==='audio'){connection('AUDIO DIRECT · RÉCEPTION DE TRAMES',false,true);$('disconnect').disabled=false;status(detail)}else if(state==='connecting'||state==='socket'||state==='waiting'){connection('CONNEXION KIWI · '+detail,false,false);$('disconnect').disabled=false;status(detail)}else if(state==='error'||state==='closed'){connection('AUDIO INDISPONIBLE · '+detail,true,false);radioConnected=false;$('connect').disabled=false;$('disconnect').disabled=true;scanStop('Scan arrêté : aucune réception audio confirmée')}else{connection('HORS LIGNE · '+detail);radioConnected=false;$('disconnect').disabled=true;$('connect').disabled=false;scanStop('Scan arrêté')}
 syncDisplay();if(state==='audio')$('connect').disabled=false}
function onMeter({smeter,level,frames,rate}){
 lastDb=level;
 $('frames').textContent=`${frames} trame${frames>1?'s':''} audio`;
 $('audioRate').textContent=`${Math.round(rate)} Hz`;
 $('signal').textContent=`${Math.round(smeter)} dBm`;
 const bar=Math.max(0,Math.min(9,Math.round((smeter+121)/6)));
 $('smeter').textContent=`S ${bar}`;
 $('meterInfo').textContent=`${Math.round(smeter)} dBm · RADIO`;
 if(!scan||frames<=scan.lastFrames)return;
 const now=Date.now(),s=scan;
 s.lastFrames=frames;
 if(!Number.isFinite(smeter))return;
 if(s.state==='running'){
   // Un signal fort est reconnu même s'il était déjà présent au début de la mesure.
   // Un signal plus faible doit dépasser le plancher de bruit mesuré.
   if(now-s.startAt<420){s.noiseSamples.push(smeter);return}
   if(!s.calibrated){
     const samples=s.noiseSamples.filter(Number.isFinite).sort((a,b)=>a-b);
     s.noise=samples.length?samples[Math.floor(samples.length/2)]:-120;
     s.calibrated=true;
     s.threshold=s.name==='cb'?Math.max(-106,s.noise+5):Math.max(-108,s.noise+6);
   }
   const strong=smeter>=(s.name==='cb'?-94:-97);
   const aboveNoise=smeter>=s.threshold;
   const active=strong||aboveNoise;
   if(active){
     if(!s.hitSince)s.hitSince=now;
     if(now-s.hitSince>=(300)){
       s.state='listening';clearTimeout(s.timer);
       s.lastActivity=now;s.listenStart=now;
       $('resumeScan').disabled=false;$('pauseScan').disabled=true;
       status(`Activité radio sur ${format(settings.hz)} MHz · écoute en cours`);
       $('scanInfo').textContent=`Signal ${Math.round(smeter)} dBm · reprise après 5 s sans activité (maximum 90 s)`;if(s.name==='cb'){$('cbInfo').textContent=`Activité radio détectée sur canal ${s.channel||cbChannel} · ${format(settings.hz)} MHz (non nécessairement une voix)`;$('cbScanState').textContent='SIGNAL DÉTECTÉ';}
       updateScanPanel('ÉCOUTE · SIGNAL');
     }
   }else{s.hitSince=0}
 }else if(s.state==='listening'){
   if(smeter>=Math.max(-110,s.threshold-3)||smeter>=-100)s.lastActivity=now;
   if(now-s.lastActivity>=5000||now-s.listenStart>=90000){
     s.state='running';$('pauseScan').disabled=false;$('resumeScan').disabled=true;
     status('Fin d’activité · reprise du balayage');scanStep();
   }
 }
}
for(const b of BANDS){const button=document.createElement('button');button.textContent=b.label;button.dataset.band=b.id;button.onclick=()=>{changeMode(b.mode);tune(b.hz,b.id)};$('bands').append(button)}
$('mode').onchange=()=>changeMode($('mode').value);
for(const button of document.querySelectorAll('[data-step]'))button.onclick=()=>tune(settings.hz+Number(button.dataset.step));
$('manualFrequency').addEventListener('focus',()=>{manualEditing=true});
$('manualFrequency').addEventListener('blur',()=>{manualEditing=false});
$('apply').onclick=()=>{manualEditing=false;tune(Number($('manualFrequency').value.replace(',','.'))*1e6)};
$('volume').value=settings.volume;$('volumeValue').textContent=settings.volume+' %';
$('volume').oninput=()=>{settings.volume=Number($('volume').value);radio.setVolume(settings.volume/100);$('volumeValue').textContent=settings.volume+' %';persist()};
if(settings.squelch<-125||settings.squelch>-65)settings.squelch=-105;$('squelch').value=settings.squelch;$('squelchValue').textContent=settings.squelch+' dBm';
$('squelch').oninput=()=>{settings.squelch=Number($('squelch').value);radio.setSquelch(settings.squelch);$('squelchValue').textContent=settings.squelch+' dBm';persist()};
radio.setVolume(settings.volume/100);radio.setSquelch(settings.squelch);
$('relay').value=settings.relay||'';
radio.setRelay(settings.relay||'');
function saveRelay(){
 const value=$('relay').value.trim();
 if(value&&!SuperstarKiwi.audioRelayUrl(value,1234)){
  $('relayStatus').textContent='Adresse invalide : HTTPS requis';return false;
 }
 settings.relay=value;radio.setRelay(value);persist();return true;
}
$('relay').addEventListener('change',saveRelay);
$('relay').addEventListener('input',()=>{$('relayStatus').textContent='Adresse modifiée : cliquez sur VÉRIFIER LE RELAIS';});
async function checkRelay(){
 const button=$('diag'), display=$('relayStatus');
 if(!saveRelay())return;
 const value=settings.relay;
 if(!value){display.textContent='Aucun relais renseigné';return;}
 button.disabled=true;button.textContent='VÉRIFICATION EN COURS…';
 display.textContent='Connexion au relais Cloudflare en cours…';
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const url=new URL('/health',value.endsWith('/')?value:value+'/');
  const response=await fetch(url.href,{cache:'no-store',signal:controller.signal});
  const data=await response.json();
  display.textContent=response.ok&&data.service==='superstar-kiwi-relay'
   ?'Relais Cloudflare accessible ✓ — flux audio KiwiSDR non encore vérifié'
   :`Réponse inattendue du relais (HTTP ${response.status})`;
 }catch(error){display.textContent='Échec du test : '+(error.name==='AbortError'?'délai de 10 secondes dépassé':error.message);}
 finally{clearTimeout(timeout);button.disabled=false;button.textContent='VÉRIFIER LE RELAIS';}
}
$('diag').addEventListener('click',checkRelay);
$('server').value=settings.server;$('server').onchange=()=>{if(SuperstarKiwi.parseServer($('server').value)){settings.server=$('server').value.trim();persist()}else status('Adresse serveur invalide')};
const rxSelect=$('receiverSelect');
for(const item of RECEIVERS){const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.label;rxSelect.append(opt)}
function relayForReceiver(id){return DEFAULT_RELAY.replace(/\/$/,'')+(id==='original'?'':'/rx/'+id)}
function chooseReceiver(id){const item=RECEIVERS.find(r=>r.id===id);if(!item)return;
 if(radioConnected){radio.disconnect();scanStop('Changement de récepteur : relancez ÉCOUTER')}
 settings.receiverId=id;settings.server=item.url;settings.relay=relayForReceiver(id);
 $('server').value=settings.server;$('relay').value=settings.relay;radio.setRelay(settings.relay);persist();
 $('receiverNote').textContent=id==='original'?'Récepteur historique.':'Récepteur répertorié, disponibilité audio non confirmée. Nécessite le Worker V2.9.';
 status('Récepteur choisi : '+item.label+' · appuyez sur ÉCOUTER');}
rxSelect.value=settings.receiverId;
rxSelect.onchange=()=>chooseReceiver(rxSelect.value);
if(settings.receiverId!=='original')chooseReceiver(settings.receiverId);
$('scanSpeed').value=settings.scanSpeed;
$('scanSpeed').onchange=()=>{settings.scanSpeed=$('scanSpeed').value;persist();status('Scan : '+(settings.scanSpeed==='fast'?'RAPIDE ×1,5':'NORMAL'))};
$('connect').onclick=async()=>{if(!saveRelay())return;const server=SuperstarKiwi.parseServer($('server').value);if(!server){status('Adresse KiwiSDR invalide');return}settings.server=server.href;radio.setRelay(settings.relay||'');persist();scanStop('Préparation du moteur audio');$('connect').disabled=true;try{await radio.connect(settings.server,settings.hz,settings.mode)}catch(e){status('Erreur moteur audio : '+(e.message||String(e)));$('connect').disabled=false}};
$('disconnect').onclick=()=>{radio.disconnect();scanStop('Arrêt manuel');};
function range(start,end,step,mode,name){const out=[];for(let hz=start;hz<=end;hz+=step)out.push({hz,mode,name});return out}
const SCAN_SETS={
 fr:[...range(7100000,7200000,2500,'lsb','40 m'),...range(3650000,3700000,2500,'lsb','80 m'),...range(14125000,14300000,2500,'usb','20 m')],
 qso:[...range(3650000,3700000,2500,'lsb','80 m'),...range(18120000,18165000,2500,'usb','17 m'),...range(24930000,24990000,2500,'usb','12 m')]
};
function scanDuration(name){return Math.round((name==='cb'?2000:2400)/(settings.scanSpeed==='fast'?1.5:1));}
function startScan(name){if(!radio.audioStarted||!radio.ws||radio.ws.readyState!==WebSocket.OPEN){status('SCAN INDISPONIBLE : attendre de vraies trames audio KiwiSDR');return}
 scanStop('Nouveau balayage');let list=name==='fr'?SCAN_SETS.fr:name==='qso'?SCAN_SETS.qso:(()=>{const b=BANDS.find(b=>b.id===settings.band)||BANDS[1];return range(b.start,b.end,2500,b.mode,b.label)})();
 scan={name,list,index:0,timer:null,state:'running',threshold:-108,lastFrames:radio.audioFrames,startAt:Date.now(),hits:0,lastActivity:0,listenStart:0,noiseSamples:[],calibrated:false,hitSince:0};$('stopScan').disabled=false;$('pauseScan').disabled=false;$('resumeScan').disabled=true;scanStep()}
function scanStep(){if(!scan||scan.state!=='running')return;const s=scan;const next=s.list[s.index%s.list.length];s.index++;if(s.name==='cb'){s.channel=next.channel;cbChannel=next.channel;showCb();$('cbScanState').textContent='BALAYAGE';}
 if(!radio.tune(next.hz,next.mode)){scanStop('Scan stoppé : accord refusé');return}
 settings.hz=next.hz;settings.mode=next.mode;settings.band=BANDS.find(b=>next.hz>=b.start&&next.hz<=b.end)?.id||null;syncDisplay();s.hits=0;s.threshold=0;s.noiseSamples=[];s.calibrated=false;s.hitSince=0;s.startAt=Date.now();s.lastFrames=radio.audioFrames;status(`SCAN ${s.name.toUpperCase()} · ${format(next.hz)} MHz ${next.mode.toUpperCase()}`);$('scanInfo').textContent=`Recherche d’activité : ${next.name} · ${s.index}/${s.list.length} positions`;updateScanPanel('BALAYAGE');s.timer=setTimeout(scanStep,scanDuration(s.name))}
$('scanFR').onclick=()=>startScan('fr');$('scanQSO').onclick=()=>startScan('qso');$('scanBand').onclick=()=>startScan('band');
$('pauseScan').onclick=()=>{if(!scan||!['running','listening'].includes(scan.state))return;scan.state='paused';clearTimeout(scan.timer);$('pauseScan').disabled=true;$('resumeScan').disabled=false;status('Balayage en pause');updateScanPanel('PAUSE MANUELLE')};
$('resumeScan').onclick=()=>{if(!scan||!['paused','listening'].includes(scan.state))return;scan.state='running';$('pauseScan').disabled=false;$('resumeScan').disabled=true;scanStep()};
$('stopScan').onclick=()=>scanStop();
function renderMemories(){const parent=$('memoryList');parent.replaceChildren();if(settings.memories.length===0){const p=document.createElement('p');p.className='subtle';p.textContent='Aucune mémoire enregistrée.';parent.appendChild(p);return}
 settings.memories.forEach((mem,index)=>{const row=document.createElement('div');row.className='memory';const body=document.createElement('div');body.className='memText';const strong=document.createElement('strong');strong.textContent=`${format(mem.hz)} MHz · ${mem.mode.toUpperCase()}`;const small=document.createElement('small');small.textContent=mem.server||'';body.append(strong,small);const recall=document.createElement('button');recall.textContent='RAPPEL';recall.onclick=()=>{if(scan)scanStop('Scan arrêté');if(mem.server){settings.server=mem.server;$('server').value=mem.server}changeMode(mem.mode==='nfm'?'nbfm':mem.mode);tune(mem.hz);status('Mémoire rappelée : '+format(mem.hz)+' MHz')};const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','Supprimer cette mémoire');del.onclick=()=>{settings.memories.splice(index,1);persist();renderMemories()};row.append(body,recall,del);parent.append(row)})}
$('save').onclick=()=>{const parsed=SuperstarKiwi.parseServer($('server').value);if(!parsed){status('Adresse du KiwiSDR invalide');return}const m={hz:settings.hz,mode:settings.mode,server:parsed.origin+'/'};if(settings.memories.some(x=>x.hz===m.hz&&x.mode===m.mode&&x.server===m.server)){status('Cette fréquence est déjà en mémoire');return}settings.memories.unshift(m);settings.memories=settings.memories.slice(0,120);persist();renderMemories();status('Fréquence mémorisée')};
function externalLink(){const u=SuperstarKiwi.parseServer($('server').value);if(!u){status('Adresse KiwiSDR invalide');return null}u.searchParams.set('f',(settings.hz/1000).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+(settings.mode==='nfm'?'nbfm':settings.mode));return u.href}
$('external').onclick=()=>{const url=externalLink();if(url)window.open(url,'_blank','noopener,noreferrer')};
$('embed').onclick=()=>{const url=externalLink();if(!url)return;const u=new URL(url);if(u.protocol==='http:')u.protocol='https:';const frame=$('kiwiFrame');$('embedView').hidden=false;frame.src=u.href;status('Essai d’affichage intégré en HTTPS (peut être refusé par le serveur)')};
$('closeEmbed').onclick=()=>{$('kiwiFrame').src='about:blank';$('embedView').hidden=true};
window.addEventListener('pagehide',()=>radio.disconnect(false));
syncDisplay();renderMemories();connection('HORS LIGNE · appuyez sur ÉCOUTER ICI');
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js?v=28', {updateViaCache:'none'}).catch(()=>{});

// V2.7 : sélecteur CB. Les 40 canaux normalisés incluent les sauts de fréquence historiques.
const CB_FREQ_KHZ=[26965,26975,26985,27005,27015,27025,27035,27055,27065,27075,27085,27105,27115,27125,27135,27155,27165,27175,27185,27205,27215,27225,27255,27235,27245,27265,27275,27285,27295,27305,27315,27325,27335,27345,27355,27365,27375,27385,27395,27405];
let cbChannel=19;
function startCbScan(){
 if(!radio.audioStarted||!radio.ws||radio.ws.readyState!==WebSocket.OPEN){status('SCAN CB : appuyez d’abord sur ÉCOUTER et attendez les trames audio');return;}
 // La portée réelle dépend de l’antenne KiwiSDR; le scan n’est pas une reconnaissance vocale.
 scanStop('Démarrage du scan CB');
 const mode=$('cbMode').value;
 const list=CB_FREQ_KHZ.map((khz,i)=>({hz:khz*1000,mode,name:'CB',channel:i+1}));
 const startIndex=(cbChannel-1+40)%40;
 const ordered=list.slice(startIndex).concat(list.slice(0,startIndex));
 scan={name:'cb',list:ordered,index:0,timer:null,state:'running',threshold:-106,lastFrames:radio.audioFrames,startAt:Date.now(),hits:0,lastActivity:0,listenStart:0,noiseSamples:[],calibrated:false,hitSince:0};
 $('cbScanStop').disabled=false;$('cbScan').disabled=true;
 $('stopScan').disabled=false;$('pauseScan').disabled=false;$('resumeScan').disabled=true;
 $('cbInfo').textContent='Balayage des 40 canaux · détection expérimentale des signaux';
 scanStep();
}
$('cbScan').onclick=startCbScan;
$('cbScanStop').onclick=()=>scanStop('Scan CB arrêté · écoute maintenue');

function showCb(){
 const khz=CB_FREQ_KHZ[cbChannel-1];
 $('cbChannel').textContent=String(cbChannel).padStart(2,'0');
 $('cbFrequency').textContent=(khz/1000).toFixed(3).replace('.',',')+' MHz';
 $('cbInfo').textContent='Canal '+cbChannel+(cbChannel===19?' · routiers':cbChannel===27?' · appel CB':'')+' · '+(khz/1000).toFixed(3).replace('.',',')+' MHz';
}
$('cb19').onclick=()=>{cbChannel=19;showCb();};
$('cb27').onclick=()=>{cbChannel=27;showCb();};
$('cbPrev').onclick=()=>{cbChannel=cbChannel===1?40:cbChannel-1;showCb();};
$('cbNext').onclick=()=>{cbChannel=cbChannel===40?1:cbChannel+1;showCb();};
$('cbTune').onclick=()=>{
 const hz=CB_FREQ_KHZ[cbChannel-1]*1000,mode=$('cbMode').value;
 // Ne pas afficher un succès de réception si le récepteur n'est pas connecté.
 changeMode(mode);tune(hz,'cb');
 status('CB canal '+cbChannel+' · '+format(hz)+' MHz · '+mode.toUpperCase()+(radioConnected?' · accord demandé':' · accord préparé (connectez le récepteur)'));
};
showCb();

// V3.0 : navigation par panneaux. Les éléments d'origine conservent leurs IDs et leurs événements.
(function initPages(){
 const pages={hf:document.getElementById('page-hf'),cb:document.getElementById('page-cb'),tune:document.getElementById('page-tune'),settings:document.getElementById('page-settings')};
 const move=(selector,page)=>{const el=document.querySelector(selector);if(el&&pages[page])pages[page].appendChild(el)};
 move('#hfDrawer','hf');
 move('#cbPanel','cb');
 move('.fine','tune');
 move('.quick','tune');
 move('.drawer:has(#bands)','tune');
 move('.drawer:has(#memoryList)','tune');
 move('.rxQuick','settings');
 move('.speedQuick','settings');
 move('.drawer:has(#diag)','settings');
 // Scan HF directement visible, sans clic supplémentaire.
 const hf=document.getElementById('hfDrawer');if(hf){hf.open=true;hf.classList.add('flatDrawer');}
 const tabs=[...document.querySelectorAll('.pageTabs .tab')];
 function activate(page){
  if(!pages[page])return;
  for(const [id,pane] of Object.entries(pages)){pane.hidden=id!==page;pane.classList.toggle('active',id===page)}
  for(const button of tabs){const selected=button.dataset.page===page;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected))}
  try{sessionStorage.setItem('superstar-page',page)}catch(_){}
  window.scrollTo({top:0,behavior:'instant'});
 }
 tabs.forEach(button=>button.addEventListener('click',()=>activate(button.dataset.page)));
 let initial='hf';try{initial=sessionStorage.getItem('superstar-page')||'hf'}catch(_){}
 activate(initial);
})();
