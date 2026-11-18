/* SUPERSTAR SDR Mobile V2.1 — expérimentation du client audio KiwiSDR en navigateur.
   Peut utiliser un relais Cloudflare Worker privé et fixé à un seul KiwiSDR. Nécessite WSS côté iPhone.
   Basé sur la documentation publique du protocole KiwiSDR (SET, SND, MSG).
   Aucun son simulé et aucun statut « audio connecté » avant réception des trames SND.
*/
(function(root){'use strict';
const INDEX_TABLE=[-1,-1,-1,-1,2,4,6,8];
const STEP_TABLE=[7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
const acceptedModes=new Set(['am','lsb','usb','nbfm']);
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function parseServer(value){let u;try{u=new URL(/^[a-z]+:\/\//i.test(value.trim())?value.trim():'http://'+value.trim())}catch(_){return null}return ['http:','https:'].includes(u.protocol)&&u.hostname?u:null}
function tuneCommand(hz,mode){if(!Number.isFinite(hz)||hz<10000||hz>30000000||!acceptedModes.has(mode))throw Error('Accord radio invalide');const cuts=mode==='lsb'?[-2700,-300]:mode==='usb'?[300,2700]:mode==='nbfm'?[-5000,5000]:[-4500,4500];return `SET mod=${mode} low_cut=${cuts[0]} high_cut=${cuts[1]} freq=${(hz/1000).toFixed(3)}`}
function audioWsUrl(server,ts,omitPort=false){const u=parseServer(server);if(!u)return null;const hostname=u.hostname.includes(':')?`[${u.hostname}]`:u.hostname;const port=(omitPort?'':u.port?':'+u.port:'');return `wss://${hostname}${port}/ws/kiwi/${ts}/SND`}
function audioRelayUrl(relay,ts){if(!relay)return null;let u;try{u=new URL(relay)}catch(_){return null}if(u.protocol!=='https:'||!u.hostname)return null;return `wss://${u.host}/ws/kiwi/${ts}/SND`}
function connectionCandidates(server,relay,ts){const u=parseServer(server);if(!u)return [];const choices=[];if(relay){const relayUrl=audioRelayUrl(relay,ts);if(relayUrl)choices.push({name:'Relais HTTPS privé',url:relayUrl})}if(u.port)choices.push({name:'Kiwi HTTPS 443',url:audioWsUrl(server,ts,true)});choices.push({name:'Kiwi WSS direct',url:audioWsUrl(server,ts,false)});return [...new Map(choices.map(x=>[x.url,x])).values()]}

class KiwiAudio{
 constructor(callbacks={}){this.cb=callbacks;this.ws=null;this.context=null;this.volume=0.7;this.squelch=-75;this.sampleRate=12000;this.mode='lsb';this.hz=7150000;this.audioFrames=0;this.lastRms=-100;this.smeter=null;this.decoderIndex=0;this.decoderSample=0;this.started=false;this.ready=false;this.nextTime=0;this.keepalive=null;this.timeout=null;this.lastAudio=0;this.audioStarted=false;this.generation=0;this.sequence=null;this.lastState='idle';this.relay='';this.connectAttempts=[];this.attemptIndex=0;this.connectionSession=0}
 notify(s,detail=''){this.lastState=s;this.cb.state?.(s,detail)}
 setVolume(v){this.volume=clamp(Number(v),0,1)}
 setSquelch(v){this.squelch=clamp(Number(v),-100,0)}
 setRelay(v){this.relay=v||''}
 async connect(server,hz,mode){this.disconnect(false);this.hz=hz;this.mode=mode;this.audioFrames=0;this.smeter=null;this.audioStarted=false;this.started=false;this.ready=false;this.lastAudio=0;this.decoderIndex=0;this.decoderSample=0;this.sequence=null;this.generation++;const id=this.generation;
  if(!parseServer(server))throw Error('Adresse du récepteur invalide');
  const AudioCtx=root.AudioContext||root.webkitAudioContext;
  if(!AudioCtx)throw Error('API audio indisponible dans Safari');
  try{this.context=new AudioCtx();await this.context.resume()}catch(e){this.notify('error','Audio interdit : touchez ÉCOUTER et autorisez le son');throw e}
  const ts=Date.now();this.connectAttempts=connectionCandidates(server,this.relay,ts);this.attemptIndex=0;this.connectionSession=id;
  if(!this.connectAttempts.length){this.notify('error','Aucune adresse WSS utilisable');return}
  this.tryNextConnection(id);
 }
 tryNextConnection(id){if(this.generation!==id)return;
  const current=this.connectAttempts[this.attemptIndex];if(!current){this.notify('error','Toutes les connexions WSS ont échoué. Vérifie le relais / le serveur.');return}
  this.notify('connecting',`Essai ${this.attemptIndex+1}/${this.connectAttempts.length} : ${current.name}`);
  let ws;try{ws=new WebSocket(current.url);ws.binaryType='arraybuffer'}catch(e){this.notify('error',`Connexion refusée : ${current.name}`);this.attemptIndex++;this.tryNextConnection(id);return}
  this.ws=ws;let opened=false;const self=this;
  ws.onopen=()=>{if(self.generation!==id)return;opened=true;self.notify('socket',`${current.name} : socket ouvert, initialisation Kiwi…`);self.send('SET auth t=kiwi p=#');self.send('SET ident_user=Superstar_SDR_Mobile');self.send('SET compression=0');self.send('SET keepalive');self.keepalive=setInterval(()=>self.send('SET keepalive'),5000)};
  ws.onmessage=e=>{if(self.generation===id)self.onMessage(e.data)};
  ws.onerror=()=>{if(self.generation===id)self.notify('connecting',`WebSocket refusé : ${current.name}`)};
  ws.onclose=e=>{if(self.generation!==id)return;self.stopTimers();self.ws=null;if(self.audioFrames>0){self.notify('closed',`Flux interrompu : code ${e.code||'?'}`);return}
   self.attemptIndex++;if(self.attemptIndex<self.connectAttempts.length){self.tryNextConnection(id);return}
   self.notify('error',`Aucune trame audio (${e.code||'?'}) après ${self.connectAttempts.length} essai(s). Serveur/HTTPS non compatibles ou accès refusé.`)};
  this.timeout=setTimeout(()=>{if(this.generation!==id)return;if(this.audioFrames===0){this.notify('connecting',`Pas de son : ${current.name}, essai suivant…`);try{ws.close()}catch(_){}}},11000);
}
 stopTimers(){if(this.keepalive!==null)clearInterval(this.keepalive);if(this.timeout!==null)clearTimeout(this.timeout);this.keepalive=this.timeout=null}
 disconnect(show=true){this.generation++;this.stopTimers();const ws=this.ws;this.ws=null;this.ready=false;this.started=false;this.nextTime=0;if(ws){try{ws.onmessage=null;ws.onclose=null;ws.close()}catch(_){}}const ctx=this.context;this.context=null;if(ctx)ctx.close().catch(()=>{});if(show)this.notify('idle','Réception arrêtée')}
 send(s){if(this.ws?.readyState===WebSocket.OPEN){this.ws.send(s);return true}return false}
 tune(hz,mode){if(!this.send(tuneCommand(hz,mode)))return false;this.hz=hz;this.mode=mode;this.cb.tuned?.(hz,mode);return true}
 initDSP(){if(this.started)return;this.started=true;this.send(`SET AR OK in=${Math.round(this.sampleRate)} out=${Math.round(this.context?.sampleRate||44100)}`);this.send('SET compression=0');this.send('SET agc=1 hang=0 thresh=-100 slope=6 decay=1000 manGain=50');this.tune(this.hz,this.mode);this.notify('waiting','Accord demandé · attente de trames audio SND…')}
 onMessage(data){if(typeof data==='string'){this.onText(data);return}if(!(data instanceof ArrayBuffer))return;const bytes=new Uint8Array(data);if(bytes.length<3)return;const label=String.fromCharCode(bytes[0],bytes[1],bytes[2]);if(label==='MSG'){this.onText(new TextDecoder('utf-8').decode(bytes.subarray(3)));return}if(label==='SND')this.onSound(bytes)}
 onText(text){if(/too_busy|badp|down=|inactivity_timeout|kick_by_admin/i.test(text)){this.notify('error',text.slice(0,140));return}const rate=text.match(/(?:audio_rate|sample_rate)=([\d.]+)/);if(rate){const hz=Number(rate[1]);if(hz>=8000&&hz<=24000){this.sampleRate=hz;this.initDSP()}}}
 onSound(bytes){if(bytes.length<12||!this.context)return;const flags=bytes[3];const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const m=dv.getInt16(8,false);this.smeter=m/10-127;
  // flag 0x10 : IMA ADPCM compressé ; sinon échantillons PCM 16 bits.
  const compressed=(flags&0x10)!==0;const payload=bytes.subarray(10);let samples;
  if(compressed){samples=this.decodeADPCM(payload)}else{if(payload.length%2!==0)return;samples=new Float32Array(payload.length/2);const view=new DataView(payload.buffer,payload.byteOffset,payload.byteLength);for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,false)/32768}
  if(!samples.length)return;let sum=0;for(const v of samples)sum+=v*v;const rms=Math.sqrt(sum/samples.length);this.lastRms=20*Math.log10(Math.max(rms,1e-6));this.audioFrames++;this.lastAudio=Date.now();this.cb.meter?.({smeter:this.smeter,level:this.lastRms,frames:this.audioFrames,rate:this.sampleRate});
  if(!this.audioStarted){this.audioStarted=true;this.notify('audio','Trames audio KiwiSDR reçues · lecture en cours')}
  if(this.lastRms>=this.squelch&&this.volume>0)this.play(samples)
 }
 decodeADPCM(payload){const out=new Float32Array(payload.length*2);let j=0;for(let b of payload){for(const nib of [b&15,(b>>>4)&15]){const step=STEP_TABLE[this.decoderIndex];let diff=step>>3;if(nib&4)diff+=step;if(nib&2)diff+=step>>1;if(nib&1)diff+=step>>2;this.decoderSample=clamp(this.decoderSample+((nib&8)?-diff:diff),-32768,32767);this.decoderIndex=clamp(this.decoderIndex+INDEX_TABLE[nib&7],0,88);out[j++]=this.decoderSample/32768}}return out}
 play(samples){const ctx=this.context;if(!ctx||ctx.state==='closed')return;const now=ctx.currentTime;if(this.nextTime<now||this.nextTime>now+0.75)this.nextTime=now+0.09;const b=ctx.createBuffer(1,samples.length,this.sampleRate);b.getChannelData(0).set(samples);const src=ctx.createBufferSource();src.buffer=b;const gain=ctx.createGain();gain.gain.value=this.volume;src.connect(gain);gain.connect(ctx.destination);src.onended=()=>{src.disconnect();gain.disconnect()};src.start(this.nextTime);this.nextTime+=b.duration}
}
root.SuperstarKiwi={KiwiAudio,parseServer,tuneCommand,audioWsUrl,audioRelayUrl,connectionCandidates};
})(window);
