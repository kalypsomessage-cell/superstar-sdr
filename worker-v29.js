/* SUPERSTAR SDR V2.9 — relais KiwiSDR à liste fixe, sans proxy HTTP ouvert.
   Déployer uniquement dans votre propre Cloudflare Worker.
   Les récepteurs peuvent être indisponibles, occupés ou refuser les connexions.
*/
const ALLOWED_ORIGIN='https://kalypsomessage-cell.github.io';
const RECEIVERS=Object.freeze({
  original:'http://22859.proxy.kiwisdr.com:8073',
  paris:'http://f1ubl.ddns.net:8072',
  isere:'http://f6abj-kiwihf.tplinkdns.com:8073'
});
export default {
 async fetch(request){
  const url=new URL(request.url);
  const origin=request.headers.get('Origin');
  if(url.pathname==='/health'&&request.method==='GET'){
   return new Response(JSON.stringify({service:'superstar-kiwi-relay',status:'ready',version:'2.9',note:'La disponibilité audio des récepteurs n’est pas vérifiée'}),{headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':ALLOWED_ORIGIN,'cache-control':'no-store'}});
  }
  if(request.method!=='GET')return new Response('Méthode interdite',{status:405});
  const m=url.pathname.match(/^\/(?:rx\/(paris|isere)\/)?ws\/kiwi\/(\d{10,16})\/SND$/);
  if(!m)return new Response('Route interdite',{status:404});
  if(origin!==ALLOWED_ORIGIN)return new Response('Origine non autorisée',{status:403});
  if((request.headers.get('Upgrade')||'').toLowerCase()!=='websocket')return new Response('WebSocket requis',{status:426});
  const id=m[1]||'original';const upstream=RECEIVERS[id];
  try{
   const response=await fetch(upstream+'/ws/kiwi/'+m[2]+'/SND',{headers:{Upgrade:'websocket',Origin:upstream}});
   if(response.status!==101||!response.webSocket)return new Response('KiwiSDR '+id+' indisponible ou connexion refusée ('+response.status+')',{status:502});
   return new Response(null,{status:101,webSocket:response.webSocket});
  }catch(_){return new Response('Connexion au récepteur '+id+' impossible',{status:502});}
 }
};
