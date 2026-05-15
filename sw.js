const CACHE='taskkids-v1';
const FILES=['./','/index.html','/manifest.json','/icon-192.png','/icon-512.png'];

// Instala e faz cache dos arquivos
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(FILES).catch(()=>{}))
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

// Serve arquivos do cache (funciona offline)
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached)return cached;
      return fetch(e.request).then(res=>{
        if(res&&res.status===200&&res.type!=='opaque'){
          const clone=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,clone));
        }
        return res;
      }).catch(()=>caches.match('./'));
    })
  );
});

// Recebe tarefas para agendar alarmes (mesmo com app fechado)
let scheduledAlarms=[];
self.addEventListener('message',e=>{
  if(e.data?.type==='SCHEDULE'){
    scheduledAlarms.forEach(t=>clearTimeout(t));
    scheduledAlarms=[];
    const{tasks,filhas}=e.data;
    const now=Date.now();
    const todayStr=new Date().toISOString().slice(0,10);
    const todayDay=new Date().getDay();
    (tasks||[]).forEach(t=>{
      if(!t.horario||t.active===false)return;
      if(t.completions?.[todayStr])return;
      if(t.days?.length&&!t.days.includes(todayDay))return;
      const[h,m]=t.horario.split(':').map(Number);
      const alarm=new Date();alarm.setHours(h,m,0,0);
      const diff=alarm.getTime()-now;
      if(diff>0&&diff<86400000){
        const filha=filhas?.find(f=>f.id===t.filhaId);
        const tid=setTimeout(()=>{
          self.registration.showNotification(`📌 ${t.titulo}`,{
            body:filha?`Tarefa de ${filha.nome}`:'Hora da tarefa!',
            icon:'icon-192.png',badge:'icon-192.png',
            tag:t.id,vibrate:[200,100,200],
            data:{taskId:t.id}
          });
        },diff);
        scheduledAlarms.push(tid);
      }
    });
  }
});

// Clique na notificação abre o app
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
      if(list.length)return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
