/* Service worker: guarda o site no aparelho para funcionar sem internet na academia. */

const VERSAO = 'treino-v1';
const EXERCICIOS = ['bicicleta', 'cadeira-abdutora', 'cadeira-extensora', 'crucifixo-inverso', 'desenvolvimento-ombros', 'elevacao-lateral', 'elevacao-pelvica', 'eliptico', 'esteira', 'leg-press', 'mesa-flexora', 'panturrilha-sentado', 'prancha', 'pulldown-polia', 'puxada-frontal', 'remada-articulada', 'remada-baixa', 'rosca-direta', 'rosca-martelo', 'supino-maquina', 'triceps-corda', 'triceps-polia'];
const ARQUIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilo.css',
  'js/dados.js', 'js/banco.js', 'js/timer.js', 'js/grafico.js', 'js/app.js',
  'vendor/sql-wasm.js', 'vendor/sql-wasm.wasm',
  'img/icone.svg', 'img/icone-180.png', 'img/icone-192.png', 'img/icone-512.png',
  ...EXERCICIOS.flatMap(s => [`img/exercicios/${s}-0.jpg`, `img/exercicios/${s}-1.jpg`])
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(chaves => Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Código (html/css/js): tenta a rede primeiro para pegar atualizações; sem rede, usa o cache.
   Imagens e biblioteca: cache primeiro. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  const estatico = /\/(img|vendor)\//.test(url.pathname);
  if (estatico) {
    e.respondWith(caches.match(req).then(r => r || buscarEGuardar(req)));
  } else {
    e.respondWith(redePrimeiro(req));
  }
});

async function buscarEGuardar(req) {
  const resp = await fetch(req);
  if (resp.ok) {
    const c = await caches.open(VERSAO);
    c.put(req, resp.clone());
  }
  return resp;
}

async function redePrimeiro(req) {
  try {
    const resp = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), 4000))
    ]);
    if (resp.ok) {
      const c = await caches.open(VERSAO);
      c.put(req, resp.clone());
    }
    return resp;
  } catch (err) {
    const cache = await caches.match(req, { ignoreSearch: true });
    return cache || caches.match('index.html');
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(lista => {
    const aberta = lista.find(c => 'focus' in c);
    return aberta ? aberta.focus() : self.clients.openWindow('./#/treino');
  }));
});
