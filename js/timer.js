/* Timer de pausas e de exercícios por tempo, com bipes, vibração e notificação. */

const Timer = (() => {
  const CHAVE = 'treino-timer';
  let estado = null; // { modo, rotulo, total, fimEm, pausado, restantePausado, meta }
  let intervalo = null;
  let ultimoBipe = null;
  let audio = null;
  const ouvintes = new Set();
  const opcoes = { som: true, vibrar: true };
  let aoTerminar = () => {};

  /* ---------- som ---------- */

  function desbloquearAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }

  function bipe(freq = 880, duracao = 0.15, atraso = 0, volume = 0.3) {
    if (!opcoes.som || !audio) return;
    const t = audio.currentTime + atraso;
    const osc = audio.createOscillator();
    const ganho = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
    osc.connect(ganho).connect(audio.destination);
    osc.start(t);
    osc.stop(t + duracao + 0.05);
  }

  function vibrar(padrao) {
    if (opcoes.vibrar && navigator.vibrate) navigator.vibrate(padrao);
  }

  function alarme() {
    bipe(880, 0.2, 0);
    bipe(880, 0.2, 0.3);
    bipe(1320, 0.5, 0.6);
    vibrar([300, 120, 300, 120, 500]);
  }

  function notificar(e) {
    if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
    const titulo = e.modo === 'descanso' ? 'Fim do descanso' : 'Tempo concluído';
    const corpo = e.modo === 'descanso' ? 'Hora da próxima série!' : e.rotulo;
    const opts = { body: corpo, icon: 'img/icone-192.png', tag: 'treino-timer', renotify: true, vibrate: [300, 120, 300] };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(titulo, opts)).catch(() => {});
    } else {
      try { new Notification(titulo, opts); } catch (err) { /* sem suporte */ }
    }
  }

  /* ---------- estado ---------- */

  function persistir() {
    try {
      if (estado) localStorage.setItem(CHAVE, JSON.stringify(estado));
      else localStorage.removeItem(CHAVE);
    } catch (e) { /* armazenamento indisponível */ }
  }

  function restante() {
    if (!estado) return 0;
    if (estado.pausado) return estado.restantePausado;
    return Math.max(0, (estado.fimEm - Date.now()) / 1000);
  }

  function avisar() {
    ouvintes.forEach(fn => fn(estado, restante()));
  }

  function garantirLoop() {
    if (estado && !intervalo) intervalo = setInterval(tick, 250);
    if (!estado && intervalo) { clearInterval(intervalo); intervalo = null; }
  }

  function terminar(atrasado) {
    const e = estado;
    estado = null;
    persistir();
    garantirLoop();
    if (!atrasado) { alarme(); notificar(e); }
    aoTerminar(e, atrasado);
    avisar();
  }

  function tick() {
    if (!estado) return garantirLoop();
    const r = restante();
    if (!estado.pausado) {
      const s = Math.ceil(r);
      if (s <= 3 && s > 0 && s !== ultimoBipe) {
        ultimoBipe = s;
        bipe(660, 0.08);
        vibrar(60);
      }
      if (r <= 0) return terminar(false);
    }
    avisar();
  }

  function iniciar({ modo = 'livre', rotulo = 'Timer', segundos, meta = null }) {
    desbloquearAudio();
    ultimoBipe = null;
    estado = { modo, rotulo, total: segundos, fimEm: Date.now() + segundos * 1000, pausado: false, restantePausado: 0, meta };
    persistir();
    garantirLoop();
    avisar();
  }

  function pausar() {
    if (!estado || estado.pausado) return;
    estado.restantePausado = restante();
    estado.pausado = true;
    persistir();
    avisar();
  }

  function retomar() {
    if (!estado || !estado.pausado) return;
    desbloquearAudio();
    estado.fimEm = Date.now() + estado.restantePausado * 1000;
    estado.pausado = false;
    persistir();
    avisar();
  }

  function ajustar(delta) {
    if (!estado) return;
    const novo = Math.max(1, restante() + delta);
    if (estado.pausado) estado.restantePausado = novo;
    else estado.fimEm = Date.now() + novo * 1000;
    estado.total = Math.max(estado.total, novo);
    if (novo > 3) ultimoBipe = null;
    persistir();
    avisar();
  }

  function parar() {
    estado = null;
    persistir();
    garantirLoop();
    avisar();
  }

  function restaurar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (!salvo) return;
      estado = salvo;
      if (!estado.pausado && estado.fimEm <= Date.now()) return terminar(true);
      garantirLoop();
      avisar();
    } catch (e) { estado = null; }
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  // O navegador só libera o áudio depois de um toque na tela.
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, desbloquearAudio, { passive: true }));

  return {
    iniciar, pausar, retomar, ajustar, parar, restaurar, restante, bipe, alarme,
    get estado() { return estado; },
    set aoTerminar(fn) { aoTerminar = fn; },
    ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    opcoes
  };
})();
