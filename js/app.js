/* Telas, navegação e regras do treino. */

const App = (() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const CHAVES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const SIGLAS_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ICONES = {
    halter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/></svg>'
  };
  const ROTULOS_REC = {
    intensidade_musculacao: 'Intensidade na musculação',
    progressao_carga: 'Progressão de carga',
    intensidade_cardio: 'Intensidade do cardio',
    hidratacao: 'Hidratação',
    sono_horas: 'Sono',
    descanso: 'Descanso'
  };

  const abertos = new Set();   // cartões abertos na tela do treino
  const rascunho = {};         // valores digitados que ainda não viraram série
  const avisados = new Set();  // avisos de limite de tempo já exibidos
  let rotaAnterior = '';
  let navegacoes = 0;
  let wakeLock = null;
  let limpezaTela = null;

  /* ---------- utilitários ---------- */

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const cap = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const pad = n => String(n).padStart(2, '0');

  function fmtTempo(seg) {
    const s = Math.max(0, Math.round(seg));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }

  function fmtMin(seg) {
    const m = Math.round(seg / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
  }

  const fmtNum = (n, casas = 1) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas });
  const dataLocal = iso => (iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso));
  const fmtData = (iso, opts = { weekday: 'short', day: '2-digit', month: '2-digit' }) => dataLocal(iso).toLocaleDateString('pt-BR', opts);
  const fmtHora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isoLocal = d => Banco.hojeISO(d);

  function listaE(arr) {
    if (arr.length <= 1) return arr[0] || '';
    return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  }

  function lerNumero(v) {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function diaDoAno(d = new Date()) {
    return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  function baixar(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function escolherArquivo(accept) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
  }

  /* Diálogo genérico: resolve com o "value" do botão clicado ('' se fechar). */
  function dialogo({ titulo, corpo = '', botoes = [{ valor: 'ok', texto: 'OK', classe: 'primario' }] }) {
    const dlg = $('#dialogo');
    // Botão invisível no início: o Enter dentro de um campo aciona a ação principal, não a primeira da lista.
    const principal = botoes.find(b => /primario|perigo/.test(b.classe || '')) || botoes[botoes.length - 1];
    dlg.innerHTML = `<form method="dialog">
        <button value="${principal.valor}" hidden tabindex="-1" aria-hidden="true"></button>
        <h2>${esc(titulo)}</h2>
        <div class="dlg-corpo">${corpo}</div>
        <div class="dlg-botoes">${botoes.map(b => `<button class="btn ${b.classe || ''}" value="${b.valor}">${esc(b.texto)}</button>`).join('')}</div>
      </form>`;
    return new Promise(resolve => {
      dlg.addEventListener('close', () => resolve({ valor: dlg.returnValue, el: dlg }), { once: true });
      dlg.returnValue = '';
      dlg.showModal();
    });
  }

  async function confirmar(titulo, texto, { ok = 'Confirmar', perigo = false } = {}) {
    const r = await dialogo({
      titulo,
      corpo: `<p>${esc(texto)}</p>`,
      botoes: [{ valor: '', texto: 'Cancelar' }, { valor: 'ok', texto: ok, classe: perigo ? 'perigo' : 'primario' }]
    });
    return r.valor === 'ok';
  }

  /* ---------- regras do plano ---------- */

  function classeTipo(tipo) {
    const n = normalizar(tipo);
    if (n.includes('cardio')) return 'cardio';
    if (n.includes('descanso')) return 'descanso';
    return 'musculacao';
  }

  const tagTipo = tipo => `<span class="tag tag-${classeTipo(tipo)}">${esc(tipo)}</span>`;
  const tituloDia = d => (d.grupo_muscular && d.grupo_muscular.length ? listaE(d.grupo_muscular) : d.tipo);
  const ehCardio = ex => ex.series == null && ex.duracao_minutos != null;
  const ehPorTempo = ex => ex.series != null && ex.duracao_por_serie_segundos != null;

  function alvoReps(rep) {
    const m = String(rep ?? '').match(/\d+/g);
    return m ? Math.max(...m.map(Number)) : null;
  }

  function diaDaData(data = new Date()) {
    const k = CHAVES_DIA[data.getDay()];
    return Banco.dias().find(d => normalizar(d.dia).slice(0, 3) === k) || null;
  }

  function temTreino(d) {
    return d && classeTipo(d.tipo) !== 'descanso' && Banco.exerciciosDoDia(d.id).length > 0;
  }

  function proximoTreino() {
    for (let i = 1; i <= 7; i++) {
      const data = new Date();
      data.setDate(data.getDate() + i);
      const d = diaDaData(data);
      if (temTreino(d)) return { d, emDias: i };
    }
    return null;
  }

  function programa() {
    const inicio = Banco.config('data_inicio', Banco.hojeISO());
    const hoje = dataLocal(Banco.hojeISO());
    const dias = Math.round((hoje - dataLocal(inicio)) / 864e5);
    const semana = dias < 0 ? 0 : Math.floor(dias / 7) + 1;
    const fases = Banco.progressao().map(f => {
      const [de, ate] = String(f.semanas).split(/[-–]/).map(Number);
      return { ...f, de: de || 0, ate: ate || de || 0 };
    });
    const total = fases.length ? Math.max(...fases.map(f => f.ate)) : 0;
    let fase = fases.find(f => semana >= f.de && semana <= f.ate) || null;
    const concluido = total > 0 && semana > total;
    if (!fase && concluido) fase = fases[fases.length - 1];
    if (!fase && semana < 1) fase = fases[0] || null;
    return { inicio, semana, total, fase, fases, concluido };
  }

  /* Na fase que limita as séries (ex.: "2 séries por exercício"), aplica o limite. */
  function seriesPlanejadas(ex, prog = programa()) {
    if (ex.series == null) return null;
    if (Banco.config('ajustar_fase', true) && prog.fase) {
      const m = normalizar(prog.fase.musculacao).match(/(\d+)\s*series/);
      if (m) return Math.min(ex.series, Number(m[1]));
    }
    return ex.series;
  }

  function prescricao(ex, series = ex.series) {
    if (ehCardio(ex)) return `${fmtNum(ex.duracao_minutos)} min${ex.intensidade ? ' · ' + ex.intensidade : ''}`;
    const partes = [];
    if (ehPorTempo(ex)) partes.push(`${series} × ${ex.duracao_por_serie_segundos} s`);
    else partes.push(`${series ?? '?'} × ${ex.repeticoes ?? '?'}`);
    if (ex.descanso_segundos) partes.push(`descanso ${fmtTempo(ex.descanso_segundos)}`);
    return partes.join(' · ');
  }

  function pesoAtual(p = Banco.perfil()) {
    const u = Banco.get('SELECT peso_kg FROM pesagens ORDER BY data DESC LIMIT 1');
    return u ? u.peso_kg : p.peso_kg;
  }

  function calcImc(peso, altura) {
    return peso && altura ? peso / Math.pow(altura / 100, 2) : null;
  }

  function faixaImc(imc) {
    if (imc == null) return '';
    if (imc < 18.5) return 'Abaixo do peso';
    if (imc < 25) return 'Peso adequado';
    if (imc < 30) return 'Sobrepeso';
    if (imc < 35) return 'Obesidade grau I';
    if (imc < 40) return 'Obesidade grau II';
    return 'Obesidade grau III';
  }

  /* ---------- imagens ---------- */

  function midia(nome, classe = '') {
    const info = infoExercicio(nome);
    if (!info) return `<div class="midia sem-imagem ${classe}">${ICONES.halter}</div>`;
    return `<div class="midia anim ${classe}">
        <img src="${info.imagens[0]}" alt="${esc(info.titulo)}: posição 1" loading="lazy">
        <img src="${info.imagens[1]}" alt="${esc(info.titulo)}: posição 2" loading="lazy">
      </div>`;
  }

  function miniatura(nome) {
    const info = infoExercicio(nome);
    return info
      ? `<img class="thumb" src="${info.imagens[1]}" alt="" loading="lazy">`
      : `<span class="thumb sem-imagem">${ICONES.halter}</span>`;
  }

  const linkExercicio = nome => `#/exercicio/${encodeURIComponent(nome)}`;

  /* ---------- sessões ---------- */

  function sessaoAtiva() {
    return Banco.get('SELECT * FROM sessoes WHERE fim IS NULL ORDER BY id DESC LIMIT 1');
  }

  function ultimaVez(nome, ignorarSessao = 0) {
    const s = Banco.get(`SELECT s.id, s.inicio FROM sessoes s JOIN registros r ON r.sessao_id = s.id
      WHERE r.exercicio = ? AND s.fim IS NOT NULL AND s.id != ? ORDER BY s.inicio DESC LIMIT 1`, [nome, ignorarSessao]);
    if (!s) return null;
    return { inicio: s.inicio, series: Banco.all('SELECT * FROM registros WHERE sessao_id = ? AND exercicio = ? ORDER BY serie', [s.id, nome]) };
  }

  function textoSerie(r) {
    if (r.duracao_segundos != null && r.repeticoes == null) return fmtTempo(r.duracao_segundos);
    const carga = r.carga_kg != null ? `${fmtNum(r.carga_kg)} kg` : 'sem carga';
    return `${carga} × ${r.repeticoes ?? '?'}`;
  }

  async function iniciarSessao(diaId) {
    const atual = sessaoAtiva();
    if (atual) {
      if (atual.dia_id === diaId) { location.hash = '#/treino'; return; }
      const ok = await confirmar('Treino em andamento',
        `Você já tem um treino de ${cap(atual.dia)} em andamento. Descartar e começar outro?`, { ok: 'Descartar e começar', perigo: true });
      if (!ok) return;
      descartarSessao(atual.id);
    }
    const d = Banco.dia(diaId);
    Banco.inserir('INSERT INTO sessoes (dia_id, dia, tipo, grupos, inicio) VALUES (?,?,?,?,?)',
      [d.id, d.dia, d.tipo, JSON.stringify(d.grupo_muscular), new Date().toISOString()]);
    abertos.clear();
    Object.keys(rascunho).forEach(k => delete rascunho[k]);
    if (Banco.config('notificacoes_perguntado', false) === false && 'Notification' in window && Notification.permission === 'default') {
      Banco.setConfig('notificacoes_perguntado', true);
      Notification.requestPermission().catch(() => {});
    }
    location.hash = '#/treino';
  }

  function descartarSessao(id) {
    Banco.transacao(() => {
      Banco.run('DELETE FROM registros WHERE sessao_id = ?', [id]);
      Banco.run('DELETE FROM sessoes WHERE id = ?', [id]);
    });
    if (Timer.estado && Timer.estado.meta && Timer.estado.meta.sessaoId === id) Timer.parar();
    soltarWakeLock();
  }

  /* Estado calculado do treino em andamento. */
  function estadoTreino(s) {
    const prog = programa();
    const lista = s.dia_id ? Banco.exerciciosDoDia(s.dia_id) : [];
    const regs = Banco.all('SELECT * FROM registros WHERE sessao_id = ? ORDER BY serie, id', [s.id]);
    const itens = lista.map(ex => {
      const cardio = ehCardio(ex);
      const total = cardio ? 1 : (seriesPlanejadas(ex, prog) || 1);
      const feitos = regs.filter(r => r.exercicio_id === ex.id);
      return { ex, cardio, total, feitos, completo: feitos.length >= total };
    });
    const totalSeries = itens.reduce((a, i) => a + i.total, 0);
    const feitas = itens.reduce((a, i) => a + Math.min(i.feitos.length, i.total), 0);
    return { prog, itens, regs, totalSeries, feitas };
  }

  function registrar(s, ex, serie, { repeticoes = null, carga = null, duracao = null }) {
    Banco.run('DELETE FROM registros WHERE sessao_id = ? AND exercicio_id = ? AND serie = ?', [s.id, ex.id, serie]);
    Banco.inserir(`INSERT INTO registros (sessao_id, exercicio_id, exercicio, serie, repeticoes, carga_kg, duracao_segundos, feito_em)
      VALUES (?,?,?,?,?,?,?,?)`, [s.id, ex.id, ex.nome, serie, repeticoes, carga, duracao, new Date().toISOString()]);
    delete rascunho[`${ex.id}-${serie}`];
  }

  /* Depois de concluir uma série: abre o próximo exercício e inicia o descanso. */
  function aposSerie(s, exId, iniciarDescanso = true) {
    const st = estadoTreino(s);
    const idx = st.itens.findIndex(i => i.ex.id === exId);
    const item = st.itens[idx];
    const proximo = st.itens.find(i => !i.completo);
    if (item && item.completo) {
      abertos.delete(exId);
      if (proximo) abertos.add(proximo.ex.id);
    }
    if (!proximo) {
      Timer.parar();
      toast('Todas as séries concluídas! Finalize o treino.');
      render();
      return;
    }
    if (iniciarDescanso && Banco.config('auto_descanso', true) && item && !item.cardio) {
      const rotulo = item.completo
        ? `Próximo: ${proximo.ex.nome}`
        : `Próxima: série ${item.feitos.length + 1} de ${item.ex.nome}`;
      Timer.iniciar({ modo: 'descanso', rotulo, segundos: item.ex.descanso_segundos || 60, meta: { sessaoId: s.id } });
    }
    render();
  }

  function valoresDaLinha(exId, serie) {
    const linha = $(`tr[data-ex="${exId}"][data-serie="${serie}"]`);
    if (!linha) return {};
    const carga = $('[data-campo="carga"]', linha);
    const reps = $('[data-campo="reps"]', linha);
    return { carga: carga ? lerNumero(carga.value) : null, reps: reps ? lerNumero(reps.value) : null };
  }

  function alternarSerie(exId, serie) {
    const s = sessaoAtiva();
    if (!s) return;
    const ex = Banco.get('SELECT * FROM exercicios WHERE id = ?', [exId]);
    const existente = Banco.get('SELECT id FROM registros WHERE sessao_id = ? AND exercicio_id = ? AND serie = ?', [s.id, exId, serie]);
    if (existente) {
      Banco.run('DELETE FROM registros WHERE id = ?', [existente.id]);
      abertos.add(exId);
      render();
      return;
    }
    if (ehPorTempo(ex)) {
      registrar(s, ex, serie, { duracao: ex.duracao_por_serie_segundos });
    } else {
      const v = valoresDaLinha(exId, serie);
      const reps = v.reps != null ? Math.round(v.reps) : alvoReps(ex.repeticoes);
      registrar(s, ex, serie, { repeticoes: reps, carga: v.carga });
    }
    aposSerie(s, exId);
  }

  function iniciarSerieTempo(exId, serie) {
    const s = sessaoAtiva();
    const ex = Banco.get('SELECT * FROM exercicios WHERE id = ?', [exId]);
    Timer.iniciar({
      modo: 'trabalho', rotulo: `${ex.nome} · série ${serie}`, segundos: ex.duracao_por_serie_segundos,
      meta: { sessaoId: s.id, exercicioId: ex.id, serie }
    });
    render();
  }

  function iniciarCardio(exId) {
    const s = sessaoAtiva();
    const ex = Banco.get('SELECT * FROM exercicios WHERE id = ?', [exId]);
    Timer.iniciar({
      modo: 'cardio', rotulo: `${ex.nome}${ex.intensidade ? ' · ' + ex.intensidade : ''}`, segundos: Math.round(ex.duracao_minutos * 60),
      meta: { sessaoId: s.id, exercicioId: ex.id, serie: 1 }
    });
    render();
  }

  function concluirCardio(exId, segundos) {
    const s = sessaoAtiva();
    const ex = Banco.get('SELECT * FROM exercicios WHERE id = ?', [exId]);
    if (!s || !ex) return;
    const e = Timer.estado;
    if (segundos == null) {
      segundos = e && e.meta && e.meta.exercicioId === exId ? Math.round(e.total - Timer.restante()) : Math.round(ex.duracao_minutos * 60);
    }
    if (e && e.meta && e.meta.exercicioId === exId) Timer.parar();
    registrar(s, ex, 1, { duracao: segundos });
    toast(`✓ ${ex.nome}`);
    aposSerie(s, exId, false);
  }

  /* Chamado pelo timer quando a contagem chega a zero (ou já tinha zerado com o app fechado). */
  function timerTerminou(e, atrasado) {
    const s = sessaoAtiva();
    const meta = e.meta || {};
    if ((e.modo === 'cardio' || e.modo === 'trabalho') && s && meta.sessaoId === s.id) {
      const ex = Banco.get('SELECT * FROM exercicios WHERE id = ?', [meta.exercicioId]);
      if (!ex) return;
      registrar(s, ex, meta.serie || 1, { duracao: e.total });
      if (!atrasado) toast(`✓ ${ex.nome}`);
      aposSerie(s, ex.id, e.modo === 'trabalho');
      return;
    }
    if (!atrasado) toast(e.modo === 'descanso' ? 'Descanso concluído. Bora!' : 'Tempo concluído.');
    if (rotaAtual()[0] === 'treino') {
      const pendente = $('.serie-linha:not(.ok) input, .serie-linha:not(.ok) button');
      if (pendente) pendente.closest('tr').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function finalizarSessao() {
    const s = sessaoAtiva();
    if (!s) return;
    const st = estadoTreino(s);
    const decorrido = Math.round((Date.now() - Date.parse(s.inicio)) / 1000);
    const volume = st.regs.reduce((a, r) => a + (r.carga_kg || 0) * (r.repeticoes || 0), 0);
    const completos = st.itens.filter(i => i.completo).length;
    const r = await dialogo({
      titulo: 'Finalizar treino',
      corpo: `<ul class="resumo">
          <li><span>Séries</span><strong>${st.feitas} de ${st.totalSeries}</strong></li>
          <li><span>Exercícios completos</span><strong>${completos} de ${st.itens.length}</strong></li>
          ${volume ? `<li><span>Volume</span><strong>${fmtNum(volume, 0)} kg</strong></li>` : ''}
        </ul>
        <label class="campo">Duração (min)<input type="number" id="fin-min" min="1" value="${Math.max(1, Math.round(decorrido / 60))}"></label>
        <label class="campo">Observações<textarea id="fin-obs" rows="3" placeholder="Como foi o treino? Algum desconforto?"></textarea></label>`,
      botoes: [{ valor: '', texto: 'Voltar' }, { valor: 'ok', texto: 'Salvar treino', classe: 'primario' }]
    });
    if (r.valor !== 'ok') return;
    const minutos = Math.max(1, lerNumero($('#fin-min', r.el).value) || Math.round(decorrido / 60));
    const obs = $('#fin-obs', r.el).value.trim();
    Banco.run('UPDATE sessoes SET fim = ?, duracao_segundos = ?, observacoes = ? WHERE id = ?',
      [new Date().toISOString(), Math.round(minutos * 60), obs || null, s.id]);
    await Banco.salvarAgora();
    if (Timer.estado && Timer.estado.meta && Timer.estado.meta.sessaoId === s.id) Timer.parar();
    soltarWakeLock();
    abertos.clear();
    toast('Treino salvo!');
    location.hash = `#/historico/${s.id}`;
  }

  /* ---------- tela: hoje ---------- */

  function semanaAtual() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const seg = new Date(hoje);
    seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
    const feitas = new Set(Banco.all('SELECT inicio FROM sessoes WHERE fim IS NOT NULL AND inicio >= ?', [seg.toISOString()])
      .map(s => isoLocal(new Date(s.inicio))));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(seg);
      d.setDate(seg.getDate() + i);
      return { data: d, dia: diaDaData(d), feito: feitas.has(isoLocal(d)), hoje: d.getTime() === hoje.getTime() };
    });
  }

  function viewHoje() {
    const ativa = sessaoAtiva();
    const d = diaDaData();
    const prog = programa();
    const p = Banco.perfil();
    const peso = pesoAtual(p);
    const imc = calcImc(peso, p.altura_cm);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const noMes = Banco.get('SELECT COUNT(*) AS n FROM sessoes WHERE fim IS NOT NULL AND inicio >= ?', [inicioMes.toISOString()]).n;
    const hojeISO = Banco.hojeISO();
    const feitoHoje = Banco.all('SELECT inicio FROM sessoes WHERE fim IS NOT NULL ORDER BY inicio DESC LIMIT 10')
      .some(s => isoLocal(new Date(s.inicio)) === hojeISO);
    const rec = Banco.recomendacoes();
    const obs = rec.observacoes || [];
    let html = '';

    if (ativa) {
      html += `<a class="banner" href="#/treino">
          <span><strong>Treino em andamento</strong> · ${esc(cap(ativa.dia))}</span>
          <span class="banner-tempo" data-desde="${esc(ativa.inicio)}">${fmtTempo((Date.now() - Date.parse(ativa.inicio)) / 1000)}</span>
          <span class="banner-acao">Continuar ›</span>
        </a>`;
    }

    if (temTreino(d)) {
      const lista = Banco.exerciciosDoDia(d.id);
      const nEx = lista.filter(e => !e.aquecimento).length;
      const aq = lista.some(e => e.aquecimento);
      const botao = ativa && ativa.dia_id === d.id
        ? '<a class="btn primario grande" href="#/treino">Continuar treino</a>'
        : `<button class="btn primario grande" data-acao="iniciar" data-dia="${d.id}">${feitoHoje ? 'Treinar de novo' : 'Iniciar treino'}</button>`;
      html += `<section class="card hero hero-${classeTipo(d.tipo)}">
          <p class="sobre">Hoje · ${esc(cap(d.dia))}</p>
          <div class="linha-tags">${tagTipo(d.tipo)}${feitoHoje ? '<span class="tag tag-ok">✓ Concluído hoje</span>' : ''}</div>
          <h1>${esc(tituloDia(d))}</h1>
          <p class="meta">${d.duracao_estimada_minutos} min · ${nEx} exercícios${aq ? ' + aquecimento' : ''}</p>
          <div class="miniaturas">${lista.slice(0, 6).map(e => miniatura(e.nome)).join('')}</div>
          <div class="acoes">${botao}<a class="btn" href="#/dia/${d.id}">Ver exercícios</a></div>
        </section>`;
    } else {
      const prox = proximoTreino();
      html += `<section class="card hero hero-descanso">
          <p class="sobre">Hoje${d ? ' · ' + esc(cap(d.dia)) : ''}</p>
          <div class="linha-tags">${tagTipo('Descanso')}</div>
          <h1>Dia de descanso</h1>
          <p class="meta">${esc(rec.descanso || 'A recuperação também faz parte do treino.')}</p>
          ${prox ? `<p class="proximo">Próximo treino: <strong>${esc(cap(prox.d.dia))}</strong> · ${esc(tituloDia(prox.d))}</p>
            <div class="acoes"><a class="btn" href="#/dia/${prox.d.id}">Ver próximo treino</a>
            <a class="btn fantasma" href="#/semana">Treinar outro dia</a></div>` : ''}
        </section>`;
    }

    html += `<section class="card">
        <div class="card-cab"><h2>Esta semana</h2><a href="#/semana">Ver semana ›</a></div>
        <ol class="semana-strip">${semanaAtual().map(x => {
          const cls = x.dia ? classeTipo(x.dia.tipo) : 'descanso';
          const sig = { cardio: 'C', musculacao: 'M', descanso: 'D' }[cls];
          const desc = `${SIGLAS_DIA[x.data.getDay()]}: ${x.dia ? x.dia.tipo : 'sem treino'}${x.feito ? ', feito' : ''}${x.hoje ? ', hoje' : ''}`;
          return `<li><a href="${x.dia ? '#/dia/' + x.dia.id : '#/semana'}" class="dia-chip chip-${cls}${x.hoje ? ' hoje' : ''}${x.feito ? ' feito' : ''}" aria-label="${esc(desc)}">
              <span class="dia-sigla">${SIGLAS_DIA[x.data.getDay()]}</span>
              <span class="dia-ico" aria-hidden="true">${x.feito ? '✓' : sig}</span></a></li>`;
        }).join('')}</ol>
        <p class="legenda">C cardio · M musculação · D descanso · ✓ treino feito</p>
      </section>`;

    html += `<div class="tiles">
        <div class="tile"><span class="rotulo">Peso atual</span><span class="valor">${peso ? fmtNum(peso) : '—'} <small>kg</small></span></div>
        <div class="tile"><span class="rotulo">IMC</span><span class="valor">${imc ? fmtNum(imc) : '—'}</span><span class="sub">${esc(faixaImc(imc))}</span></div>
        <div class="tile"><span class="rotulo">Treinos no mês</span><span class="valor">${noMes}</span></div>
      </div>`;

    if (prog.fase) {
      const pct = prog.total ? Math.min(100, Math.round(Math.max(0, prog.semana) / prog.total * 100)) : 0;
      html += `<a class="card programa" href="#/progresso">
          <p class="sobre">Programa de ${prog.total} semanas</p>
          <h2>${prog.concluido ? 'Programa concluído!' : `Semana ${Math.max(1, prog.semana)} de ${prog.total}`} · ${esc(prog.fase.objetivo)}</h2>
          <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
          <ul class="mini">
            <li><strong>Musculação:</strong> ${esc(prog.fase.musculacao)}</li>
            <li><strong>Cardio:</strong> ${esc(prog.fase.cardio_minutos)} min</li>
          </ul>
          ${prog.concluido ? '<p class="meta">Reavalie com um profissional de educação física e monte a próxima etapa.</p>' : ''}
        </a>`;
    }

    if (obs.length) {
      html += `<section class="card dica"><p class="sobre">Lembrete do dia</p><p>${esc(obs[diaDoAno() % obs.length])}</p></section>`;
    }
    return html;
  }

  /* ---------- tela: semana ---------- */

  function viewSemana() {
    const hoje = diaDaData();
    const prog = programa();
    return `<h1 class="titulo-pag">Semana de treino</h1>` + Banco.dias().map(d => {
      const lista = Banco.exerciciosDoDia(d.id);
      const nEx = lista.filter(e => !e.aquecimento).length;
      const cls = classeTipo(d.tipo);
      const meta = cls === 'descanso' || !lista.length
        ? 'Recuperação'
        : `${esc(tituloDia(d))} · ${d.duracao_estimada_minutos} min · ${nEx} exercícios`;
      return `<a class="card dia-card borda-${cls}" href="#/dia/${d.id}">
          <div class="dia-card-texto">
            <div class="linha-tags">${tagTipo(d.tipo)}${hoje && hoje.id === d.id ? '<span class="tag tag-hoje">Hoje</span>' : ''}</div>
            <h2>${esc(cap(d.dia))}</h2>
            <p class="meta">${meta}</p>
          </div>
          <span class="seta" aria-hidden="true">›</span>
        </a>`;
    }).join('') + (prog.fase ? `<p class="nota">Fase atual (semanas ${esc(prog.fase.semanas)}): ${esc(prog.fase.musculacao)}; cardio ${esc(prog.fase.cardio_minutos)} min.</p>` : '');
  }

  /* ---------- tela: dia ---------- */

  function notaFase(d, prog) {
    if (!prog.fase) return '';
    const cls = classeTipo(d.tipo);
    if (cls === 'musculacao') {
      return `<p class="aviso">Semanas ${esc(prog.fase.semanas)} · ${esc(prog.fase.objetivo)}: ${esc(prog.fase.musculacao)}.</p>`;
    }
    if (cls === 'cardio') {
      return `<p class="aviso">Semanas ${esc(prog.fase.semanas)} · meta de cardio nesta fase: ${esc(prog.fase.cardio_minutos)} min no total. Ajuste a duração se precisar.</p>`;
    }
    return '';
  }

  function viewDia(id) {
    const d = Banco.dia(id);
    if (!d) return naoEncontrado();
    const lista = Banco.exerciciosDoDia(id);
    const prog = programa();
    const ativa = sessaoAtiva();
    const descanso = classeTipo(d.tipo) === 'descanso' || !lista.length;
    const botao = descanso ? ''
      : ativa && ativa.dia_id === d.id
        ? '<a class="btn primario grande" href="#/treino">Continuar treino</a>'
        : `<button class="btn primario grande" data-acao="iniciar" data-dia="${d.id}">Iniciar treino</button>`;
    return `<a class="voltar" href="#/semana">‹ Semana</a>
      <header class="cab-pag">
        <div class="linha-tags">${tagTipo(d.tipo)}</div>
        <h1>${esc(cap(d.dia))}</h1>
        <p class="meta">${descanso ? 'Dia de recuperação' : `${esc(tituloDia(d))} · ${d.duracao_estimada_minutos} min`}</p>
      </header>
      ${descanso ? `<section class="card"><p>${esc(Banco.recomendacoes().descanso || 'Descanse e se hidrate.')}</p></section>` : notaFase(d, prog)}
      ${lista.length ? `<ul class="lista-ex card">${lista.map(ex => `<li><a href="${linkExercicio(ex.nome)}">
          ${miniatura(ex.nome)}
          <span class="lista-ex-texto"><strong>${esc(ex.nome)}</strong>
          <small>${ex.aquecimento ? 'Aquecimento · ' : ''}${esc(prescricao(ex, seriesPlanejadas(ex, prog)))}</small></span>
          <span class="seta" aria-hidden="true">›</span></a></li>`).join('')}</ul>` : ''}
      <div class="acoes">${botao}<a class="btn" href="#/dia/${d.id}/editar">Editar dia</a></div>`;
  }

  /* ---------- tela: editar dia ---------- */

  function campoExercicio(ex = {}) {
    const v = k => esc(ex[k] ?? '');
    return `<fieldset class="ed-ex" data-id="${ex.id || ''}">
        <div class="ed-ex-cab">
          <input class="ed-nome" data-f="nome" value="${v('nome')}" placeholder="Nome do exercício" aria-label="Nome do exercício">
          <div class="ed-botoes">
            <button type="button" class="btn-icone" data-acao="ed-subir" aria-label="Mover para cima">↑</button>
            <button type="button" class="btn-icone" data-acao="ed-descer" aria-label="Mover para baixo">↓</button>
            <button type="button" class="btn-icone perigo" data-acao="ed-remover" aria-label="Remover exercício">✕</button>
          </div>
        </div>
        <div class="ed-grade">
          <label>Séries<input type="number" min="0" inputmode="numeric" data-f="series" value="${v('series')}"></label>
          <label>Repetições<input data-f="repeticoes" value="${v('repeticoes')}" placeholder="10-12"></label>
          <label>Descanso (s)<input type="number" min="0" inputmode="numeric" data-f="descanso_segundos" value="${v('descanso_segundos')}"></label>
          <label>Tempo/série (s)<input type="number" min="0" inputmode="numeric" data-f="duracao_por_serie_segundos" value="${v('duracao_por_serie_segundos')}"></label>
          <label>Duração (min)<input type="number" min="0" step="0.5" inputmode="decimal" data-f="duracao_minutos" value="${v('duracao_minutos')}"></label>
          <label>Intensidade<input data-f="intensidade" value="${v('intensidade')}" placeholder="Leve, Moderada…"></label>
        </div>
      </fieldset>`;
  }

  function viewEditarDia(id) {
    const d = Banco.dia(id);
    if (!d) return naoEncontrado();
    const lista = Banco.exerciciosDoDia(id);
    const aq = lista.find(e => e.aquecimento) || {};
    return `<a class="voltar" href="#/dia/${d.id}">‹ ${esc(cap(d.dia))}</a>
      <h1 class="titulo-pag">Editar ${esc(d.dia)}</h1>
      <form id="form-editar" data-dia="${d.id}" onsubmit="return false">
        <section class="card">
          <div class="ed-grade">
            <label>Tipo<input id="ed-tipo" list="tipos" value="${esc(d.tipo)}"></label>
            <label>Duração estimada (min)<input id="ed-duracao" type="number" min="0" value="${d.duracao_estimada_minutos ?? ''}"></label>
            <label class="largo">Grupos musculares (separados por vírgula)<input id="ed-grupos" value="${esc(d.grupo_muscular.join(', '))}"></label>
          </div>
          <datalist id="tipos"><option value="Musculação"><option value="Cardio"><option value="Descanso"></datalist>
        </section>
        <section class="card">
          <label class="check-linha"><input type="checkbox" id="ed-tem-aq" ${aq.id ? 'checked' : ''}> Aquecimento</label>
          <div class="ed-grade" data-id="${aq.id || ''}" id="ed-aq">
            <label class="largo">Nome<input data-f="nome" value="${esc(aq.nome || '')}" placeholder="Bicicleta ou esteira"></label>
            <label>Duração (min)<input type="number" min="0" step="0.5" data-f="duracao_minutos" value="${aq.duracao_minutos ?? ''}"></label>
            <label>Intensidade<input data-f="intensidade" value="${esc(aq.intensidade || '')}" placeholder="Leve"></label>
          </div>
        </section>
        <p class="nota">Musculação: preencha séries, repetições e descanso. Exercício por tempo (ex.: prancha): séries e tempo por série. Cardio: só a duração em minutos.</p>
        <div id="ed-lista">${lista.filter(e => !e.aquecimento).map(campoExercicio).join('')}</div>
        <button type="button" class="btn largo" data-acao="ed-adicionar">+ Adicionar exercício</button>
        <div class="acoes fixas">
          <a class="btn" href="#/dia/${d.id}">Cancelar</a>
          <button type="button" class="btn primario" data-acao="ed-salvar">Salvar alterações</button>
        </div>
      </form>`;
  }

  function lerCampos(el) {
    const o = {};
    $$('[data-f]', el).forEach(i => { o[i.dataset.f] = i.value.trim(); });
    const n = k => (o[k] === '' || o[k] == null ? null : lerNumero(o[k]));
    return {
      id: Number(el.dataset.id) || null,
      nome: o.nome || '',
      series: n('series') != null ? Math.round(n('series')) : null,
      repeticoes: o.repeticoes || null,
      descanso_segundos: n('descanso_segundos') != null ? Math.round(n('descanso_segundos')) : null,
      duracao_por_serie_segundos: n('duracao_por_serie_segundos') != null ? Math.round(n('duracao_por_serie_segundos')) : null,
      duracao_minutos: n('duracao_minutos'),
      intensidade: o.intensidade || null
    };
  }

  function salvarEdicao() {
    const form = $('#form-editar');
    const diaId = Number(form.dataset.dia);
    const itens = $$('#ed-lista .ed-ex').map(lerCampos);
    if (itens.some(i => !i.nome)) { toast('Preencha o nome de todos os exercícios.'); return; }
    if (itens.some(i => i.series == null && i.duracao_minutos == null)) {
      toast('Cada exercício precisa de séries ou de duração em minutos.');
      return;
    }
    const temAq = $('#ed-tem-aq').checked;
    const aq = lerCampos($('#ed-aq'));
    if (temAq && !aq.nome) { toast('Dê um nome ao aquecimento ou desmarque a opção.'); return; }
    const grupos = $('#ed-grupos').value.split(',').map(s => s.trim()).filter(Boolean);
    const salvar = (ex, ordem, aquecimento) => {
      const campos = [ex.nome, ex.series, ex.repeticoes, ex.descanso_segundos, ex.duracao_minutos, ex.duracao_por_serie_segundos, ex.intensidade, ordem, aquecimento ? 1 : 0];
      if (ex.id) {
        Banco.run(`UPDATE exercicios SET nome=?, series=?, repeticoes=?, descanso_segundos=?, duracao_minutos=?,
          duracao_por_serie_segundos=?, intensidade=?, ordem=?, aquecimento=? WHERE id=? AND dia_id=?`, [...campos, ex.id, diaId]);
        return ex.id;
      }
      return Banco.inserir(`INSERT INTO exercicios (nome, series, repeticoes, descanso_segundos, duracao_minutos,
          duracao_por_serie_segundos, intensidade, ordem, aquecimento, dia_id) VALUES (?,?,?,?,?,?,?,?,?,?)`, [...campos, diaId]);
    };
    Banco.transacao(() => {
      Banco.run('UPDATE dias SET tipo = ?, grupo_muscular = ?, duracao_estimada_minutos = ? WHERE id = ?',
        [$('#ed-tipo').value.trim() || 'Musculação', JSON.stringify(grupos), Math.round(lerNumero($('#ed-duracao').value) || 0), diaId]);
      const manter = [];
      if (temAq) manter.push(salvar({ ...aq, series: null, repeticoes: null, descanso_segundos: null, duracao_por_serie_segundos: null }, 0, true));
      itens.forEach((ex, i) => manter.push(salvar(ex, i + 1, false)));
      const antigos = Banco.all('SELECT id FROM exercicios WHERE dia_id = ?', [diaId]).map(r => r.id);
      antigos.filter(id => !manter.includes(id)).forEach(id => Banco.run('DELETE FROM exercicios WHERE id = ?', [id]));
    });
    toast('Dia atualizado.');
    location.hash = `#/dia/${diaId}`;
  }

  /* ---------- tela: treino em andamento ---------- */

  function linhaSerie(s, item, n, ultima) {
    const { ex } = item;
    const feito = item.feitos.find(r => r.serie === n);
    const chave = `${ex.id}-${n}`;
    const rasc = rascunho[chave] || {};
    const timerAqui = Timer.estado && Timer.estado.meta && Timer.estado.meta.exercicioId === ex.id && Timer.estado.meta.serie === n;
    const check = `<button class="check" data-acao="serie" data-ex="${ex.id}" data-serie="${n}" aria-pressed="${!!feito}"
        aria-label="${feito ? 'Desfazer' : 'Concluir'} série ${n}">✓</button>`;

    if (ehPorTempo(ex)) {
      const acao = feito ? `<span class="feito-txt">${fmtTempo(feito.duracao_segundos)}</span>`
        : timerAqui ? '<span class="rodando">Em andamento…</span>'
          : `<button class="btn mini" data-acao="serie-tempo" data-ex="${ex.id}" data-serie="${n}">▶ ${fmtTempo(ex.duracao_por_serie_segundos)}</button>`;
      return `<tr class="serie-linha${feito ? ' ok' : ''}" data-ex="${ex.id}" data-serie="${n}"><th scope="row">${n}</th><td colspan="2">${acao}</td><td>${check}</td></tr>`;
    }

    const anteriorNaSessao = [...item.feitos].filter(r => r.serie < n && r.carga_kg != null).pop();
    const ultimaSerie = ultima ? (ultima.series.find(r => r.serie === n) || ultima.series[ultima.series.length - 1]) : null;
    const carga = feito ? feito.carga_kg
      : rasc.carga ?? (anteriorNaSessao ? anteriorNaSessao.carga_kg : ultimaSerie ? ultimaSerie.carga_kg : null);
    const reps = feito ? feito.repeticoes
      : rasc.reps ?? (ultimaSerie && ultimaSerie.repeticoes != null ? ultimaSerie.repeticoes : alvoReps(ex.repeticoes));
    return `<tr class="serie-linha${feito ? ' ok' : ''}" data-ex="${ex.id}" data-serie="${n}">
        <th scope="row">${n}</th>
        <td><input type="text" inputmode="decimal" autocomplete="off" data-campo="carga" data-ex="${ex.id}" data-serie="${n}"
          value="${carga != null ? fmtNum(carga, 2) : ''}" placeholder="kg" aria-label="Carga da série ${n} em kg" ${feito ? 'disabled' : ''}></td>
        <td><input type="number" inputmode="numeric" min="0" data-campo="reps" data-ex="${ex.id}" data-serie="${n}"
          value="${reps ?? ''}" placeholder="${esc(ex.repeticoes ?? '')}" aria-label="Repetições da série ${n}" ${feito ? 'disabled' : ''}></td>
        <td>${check}</td>
      </tr>`;
  }

  function cartaoTreino(s, item, aberto) {
    const { ex } = item;
    const ultima = item.cardio ? null : ultimaVez(ex.nome, s.id);
    const status = item.completo ? '<span class="status ok" aria-label="Concluído">✓</span>'
      : `<span class="status">${item.feitos.length}/${item.total}</span>`;
    let corpo;
    if (item.cardio) {
      const feito = item.feitos[0];
      const rodando = Timer.estado && Timer.estado.meta && Timer.estado.meta.exercicioId === ex.id;
      corpo = `<div class="cardio-box">
          <p class="cardio-tempo">${fmtTempo(ex.duracao_minutos * 60)}</p>
          <p class="meta">${esc(ex.intensidade || '')}</p>
          ${feito ? `<p class="feito-txt">✓ Feito · ${fmtTempo(feito.duracao_segundos)}</p>
              <button class="btn fantasma" data-acao="serie" data-ex="${ex.id}" data-serie="1">Desfazer</button>`
            : rodando ? `<p class="rodando">Em andamento: acompanhe no timer abaixo.</p>
              <button class="btn" data-acao="cardio-concluir" data-ex="${ex.id}">Concluir agora</button>`
              : `<div class="acoes"><button class="btn primario" data-acao="cardio-iniciar" data-ex="${ex.id}">▶ Iniciar timer</button>
                <button class="btn" data-acao="cardio-feito" data-ex="${ex.id}">Marcar como feito</button></div>`}
        </div>`;
    } else {
      const linhas = Array.from({ length: item.total }, (_, i) => linhaSerie(s, item, i + 1, ultima)).join('');
      const porTempo = ehPorTempo(ex);
      corpo = `${ultima ? `<p class="ultima">Última vez (${fmtData(ultima.inicio)}): ${esc(ultima.series.map(textoSerie).join(' · '))}</p>` : ''}
        <table class="series">
          <thead><tr><th scope="col">Série</th>${porTempo ? '<th scope="col" colspan="2">Tempo</th>' : '<th scope="col">Carga (kg)</th><th scope="col">Reps</th>'}<th scope="col"><span class="sr">Feito</span></th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>`;
    }
    return `<section class="card ex${item.completo ? ' completo' : ''}${aberto ? ' aberto' : ''}" id="ex-${ex.id}">
        <button class="ex-cab" data-acao="alternar" data-ex="${ex.id}" aria-expanded="${aberto}">
          ${miniatura(ex.nome)}
          <span class="ex-titulo"><strong>${esc(ex.nome)}</strong>
            <small>${ex.aquecimento ? 'Aquecimento · ' : ''}${esc(prescricao(ex, item.cardio ? null : item.total))}</small></span>
          ${status}
        </button>
        <div class="ex-corpo"${aberto ? '' : ' hidden'}>
          <div class="ex-midia">${midia(ex.nome)}<a class="como" href="${linkExercicio(ex.nome)}">Como fazer ›</a></div>
          ${corpo}
        </div>
      </section>`;
  }

  function viewTreino() {
    const s = sessaoAtiva();
    if (!s) {
      return `<section class="card vazio"><h1>Nenhum treino em andamento</h1>
        <p>Escolha um dia para começar.</p><div class="acoes"><a class="btn primario" href="#/hoje">Ir para hoje</a>
        <a class="btn" href="#/semana">Ver semana</a></div></section>`;
    }
    const d = s.dia_id ? Banco.dia(s.dia_id) : null;
    const st = estadoTreino(s);
    const limite = (Banco.perfil().tempo_maximo_treino_minutos || 60) * 60;
    if (!abertos.size) {
      const p = st.itens.find(i => !i.completo);
      if (p) abertos.add(p.ex.id);
    }
    const grupos = JSON.parse(s.grupos || '[]');
    pedirWakeLock();
    return `<header class="card sessao-cab" data-inicio="${esc(s.inicio)}" data-limite="${limite}">
        <div>
          <p class="sobre">${esc(cap(s.dia))} · ${esc(s.tipo)}</p>
          <h1>${esc(grupos.length ? listaE(grupos) : s.tipo)}</h1>
        </div>
        <div class="sessao-numeros">
          <div><span class="rotulo">Tempo</span><strong data-desde="${esc(s.inicio)}">${fmtTempo((Date.now() - Date.parse(s.inicio)) / 1000)}</strong></div>
          <div><span class="rotulo">${classeTipo(s.tipo) === 'cardio' ? 'Etapas' : 'Séries'}</span><strong>${st.feitas}/${st.totalSeries}</strong></div>
        </div>
        <div class="barra limite" title="Limite de ${limite / 60} min por sessão"><span data-limite-barra></span></div>
        <p class="limite-txt" data-limite-txt>Limite: ${limite / 60} min por sessão</p>
      </header>
      ${d ? notaFase(d, st.prog) : '<p class="aviso">O dia deste treino foi removido do plano.</p>'}
      ${st.itens.map(i => cartaoTreino(s, i, abertos.has(i.ex.id))).join('')}
      <div class="acoes fim-treino">
        <button class="btn primario grande" data-acao="finalizar">Finalizar treino</button>
        <button class="btn fantasma perigo" data-acao="descartar">Descartar</button>
      </div>`;
  }

  function atualizarRelogios() {
    const agora = Date.now();
    $$('[data-desde]').forEach(el => { el.textContent = fmtTempo((agora - Date.parse(el.dataset.desde)) / 1000); });
    const cab = $('.sessao-cab');
    if (!cab) return;
    const decorrido = (agora - Date.parse(cab.dataset.inicio)) / 1000;
    const limite = Number(cab.dataset.limite);
    const barra = $('[data-limite-barra]', cab);
    const txt = $('[data-limite-txt]', cab);
    const pct = Math.min(100, decorrido / limite * 100);
    barra.style.width = `${pct}%`;
    const falta = limite - decorrido;
    cab.classList.toggle('alerta', falta <= 300 && falta > 0);
    cab.classList.toggle('estourou', falta <= 0);
    txt.textContent = falta > 0
      ? `Faltam ${fmtMin(falta)} para o limite de ${limite / 60} min`
      : `Passou ${fmtMin(-falta)} do limite de ${limite / 60} min`;
    const chave = cab.dataset.inicio;
    if (falta <= 300 && falta > 0 && !avisados.has(chave + 'quase')) {
      avisados.add(chave + 'quase');
      toast('Faltam 5 minutos para o limite da sessão.');
    }
    if (falta <= 0 && !avisados.has(chave + 'fim')) {
      avisados.add(chave + 'fim');
      Timer.alarme();
      toast(`Você atingiu ${limite / 60} min de treino. Hora de encerrar.`);
    }
  }

  async function pedirWakeLock() {
    if (wakeLock || document.hidden || !Banco.config('tela_ligada', true) || !('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { wakeLock = null; }
  }

  function soltarWakeLock() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  /* ---------- tela: exercício ---------- */

  function viewExercicio(nome) {
    const info = infoExercicio(nome);
    const hist = Banco.all(`SELECT r.*, s.inicio FROM registros r JOIN sessoes s ON s.id = r.sessao_id
      WHERE r.exercicio = ? AND s.fim IS NOT NULL ORDER BY s.inicio DESC, r.serie`, [nome]);
    const porSessao = [];
    hist.forEach(r => {
      let g = porSessao.find(x => x.id === r.sessao_id);
      if (!g) { g = { id: r.sessao_id, inicio: r.inicio, series: [] }; porSessao.push(g); }
      g.series.push(r);
    });
    const melhor = hist.reduce((a, r) => (r.carga_kg != null && r.carga_kg > a ? r.carga_kg : a), 0);
    const noPlano = Banco.all(`SELECT e.*, d.dia FROM exercicios e JOIN dias d ON d.id = e.dia_id WHERE e.nome = ? ORDER BY d.ordem`, [nome]);
    return `<button class="voltar" data-acao="voltar">‹ Voltar</button>
      <header class="cab-pag"><h1>${esc(nome)}</h1>
        ${info ? `<div class="chips">${info.musculos.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>` : ''}
      </header>
      <section class="card visor">
        ${midia(nome, 'grande')}
        ${info ? `<div class="visor-botoes" role="group" aria-label="Imagens do exercício">
          <button class="btn mini" data-acao="pose" data-pose="0">Posição 1</button>
          <button class="btn mini" data-acao="pose" data-pose="1">Posição 2</button>
          <button class="btn mini" data-acao="pose" data-pose="anim">Animar</button>
        </div>` : '<p class="meta">Sem imagem cadastrada para este exercício.</p>'}
      </section>
      ${noPlano.length ? `<section class="card"><h2>No seu plano</h2><ul class="simples">${noPlano.map(e =>
        `<li><strong>${esc(cap(e.dia))}:</strong> ${e.aquecimento ? 'aquecimento · ' : ''}${esc(prescricao(e, seriesPlanejadas(e)))}</li>`).join('')}</ul></section>` : ''}
      ${info ? `<section class="card"><h2>Como fazer</h2><ol class="passos">${info.passos.map(p => `<li>${esc(p)}</li>`).join('')}</ol></section>
        <section class="card"><h2>Dicas</h2><ul class="simples">${info.dicas.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        <h2>Evite</h2><ul class="simples evite">${info.erros.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section>`
        : '<section class="card"><p>Peça orientação ao professor da academia para a execução correta.</p></section>'}
      ${porSessao.length ? `<section class="card"><div class="card-cab"><h2>Seu histórico</h2>${melhor ? `<span class="tag tag-ok">Melhor carga: ${fmtNum(melhor)} kg</span>` : ''}</div>
        <ul class="historico-ex">${porSessao.slice(0, 10).map(g => `<li><a href="#/historico/${g.id}"><span>${fmtData(g.inicio)}</span>
          <span>${esc(g.series.map(textoSerie).join(' · '))}</span></a></li>`).join('')}</ul></section>` : ''}`;
  }

  /* ---------- tela: histórico ---------- */

  function sessoesFinalizadas() {
    return Banco.all(`SELECT s.*, COUNT(r.id) AS n_series, COALESCE(SUM(r.carga_kg * r.repeticoes), 0) AS volume
      FROM sessoes s LEFT JOIN registros r ON r.sessao_id = s.id
      WHERE s.fim IS NOT NULL GROUP BY s.id ORDER BY s.inicio DESC`);
  }

  function viewHistorico() {
    const lista = sessoesFinalizadas();
    if (!lista.length) {
      return `<h1 class="titulo-pag">Histórico</h1><section class="card vazio"><p>Nenhum treino salvo ainda.</p>
        <div class="acoes"><a class="btn primario" href="#/hoje">Começar o treino de hoje</a></div></section>`;
    }
    const corte = Date.now() - 30 * 864e5;
    const ult30 = lista.filter(s => Date.parse(s.inicio) >= corte);
    const tempo30 = ult30.reduce((a, s) => a + (s.duracao_segundos || 0), 0);
    const meses = [];
    lista.forEach(s => {
      const chave = new Date(s.inicio).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      let m = meses.find(x => x.chave === chave);
      if (!m) { m = { chave, itens: [] }; meses.push(m); }
      m.itens.push(s);
    });
    return `<h1 class="titulo-pag">Histórico</h1>
      <div class="tiles">
        <div class="tile"><span class="rotulo">Treinos (30 dias)</span><span class="valor">${ult30.length}</span></div>
        <div class="tile"><span class="rotulo">Tempo (30 dias)</span><span class="valor">${fmtMin(tempo30)}</span></div>
        <div class="tile"><span class="rotulo">Total de treinos</span><span class="valor">${lista.length}</span></div>
      </div>
      ${meses.map(m => `<h2 class="sub-pag">${esc(cap(m.chave))}</h2><ul class="lista-hist card">${m.itens.map(s => {
        const grupos = JSON.parse(s.grupos || '[]');
        return `<li><a href="#/historico/${s.id}">
            <span class="hist-data"><strong>${fmtData(s.inicio, { day: '2-digit' })}</strong><small>${fmtData(s.inicio, { weekday: 'short' })}</small></span>
            <span class="hist-texto"><strong>${esc(grupos.length ? listaE(grupos) : s.tipo)}</strong>
              <small>${tagTipo(s.tipo)} ${fmtMin(s.duracao_segundos || 0)} · ${s.n_series} ${s.n_series === 1 ? 'registro' : 'registros'}${s.volume ? ` · ${fmtNum(s.volume, 0)} kg` : ''}</small></span>
            <span class="seta" aria-hidden="true">›</span></a></li>`;
      }).join('')}</ul>`).join('')}`;
  }

  function viewSessao(id) {
    const s = Banco.get('SELECT * FROM sessoes WHERE id = ?', [id]);
    if (!s) return naoEncontrado();
    const regs = Banco.all('SELECT * FROM registros WHERE sessao_id = ? ORDER BY id', [id]);
    const grupos = JSON.parse(s.grupos || '[]');
    const porEx = [];
    regs.forEach(r => {
      let g = porEx.find(x => x.nome === r.exercicio);
      if (!g) { g = { nome: r.exercicio, series: [] }; porEx.push(g); }
      g.series.push(r);
    });
    porEx.forEach(g => g.series.sort((a, b) => a.serie - b.serie));
    const volume = regs.reduce((a, r) => a + (r.carga_kg || 0) * (r.repeticoes || 0), 0);
    return `<a class="voltar" href="#/historico">‹ Histórico</a>
      <header class="cab-pag">
        <div class="linha-tags">${tagTipo(s.tipo)}${s.fim ? '' : '<span class="tag tag-hoje">Em andamento</span>'}</div>
        <h1>${esc(grupos.length ? listaE(grupos) : s.tipo)}</h1>
        <p class="meta">${esc(cap(fmtData(s.inicio, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })))} · ${fmtHora(s.inicio)}</p>
      </header>
      <div class="tiles">
        <div class="tile"><span class="rotulo">Duração</span><span class="valor">${fmtMin(s.duracao_segundos || 0)}</span></div>
        <div class="tile"><span class="rotulo">Registros</span><span class="valor">${regs.length}</span></div>
        <div class="tile"><span class="rotulo">Volume</span><span class="valor">${fmtNum(volume, 0)} <small>kg</small></span></div>
      </div>
      ${s.observacoes ? `<section class="card"><h2>Observações</h2><p>${esc(s.observacoes)}</p></section>` : ''}
      <section class="card"><h2>Exercícios</h2>
        ${porEx.length ? `<ul class="lista-sessao">${porEx.map(g => `<li><a href="${linkExercicio(g.nome)}">${miniatura(g.nome)}
            <span><strong>${esc(g.nome)}</strong><small>${esc(g.series.map(textoSerie).join(' · '))}</small></span></a></li>`).join('')}</ul>`
          : '<p class="meta">Nenhuma série registrada.</p>'}
      </section>
      <div class="acoes"><button class="btn fantasma perigo" data-acao="apagar-sessao" data-id="${s.id}">Apagar este treino</button></div>`;
  }

  /* ---------- tela: progresso ---------- */

  function viewProgresso() {
    const prog = programa();
    const p = Banco.perfil();
    const pesagens = Banco.all('SELECT * FROM pesagens ORDER BY data');
    const atual = pesoAtual(p);
    const primeiro = pesagens[0];
    const imc = calcImc(atual, p.altura_cm);
    const delta = primeiro && pesagens.length > 1 ? atual - primeiro.peso_kg : null;
    const cargas = Banco.all(`SELECT r.exercicio, MAX(r.carga_kg) AS melhor, COUNT(DISTINCT r.sessao_id) AS sessoes
      FROM registros r JOIN sessoes s ON s.id = r.sessao_id
      WHERE s.fim IS NOT NULL AND r.carga_kg > 0 GROUP BY r.exercicio ORDER BY r.exercicio`)
      .map(c => {
        const u = ultimaVez(c.exercicio);
        const ultimaCarga = u ? Math.max(0, ...u.series.map(r => r.carga_kg || 0)) : null;
        return { ...c, ultimaCarga, ultimaData: u ? u.inicio : null };
      });

    return `<h1 class="titulo-pag">Progresso</h1>
      <section class="card">
        <div class="card-cab"><h2>Programa de ${prog.total} semanas</h2>
          <span class="tag tag-hoje">${prog.concluido ? 'Concluído' : prog.semana < 1 ? 'Ainda não começou' : `Semana ${prog.semana}`}</span></div>
        <label class="campo linha">Início do programa<input type="date" data-config="data_inicio" value="${esc(prog.inicio)}"></label>
        <ol class="fases">${prog.fases.map(f => `<li class="${prog.fase === f ? 'atual' : ''}"${prog.fase === f ? ' aria-current="step"' : ''}>
            <span class="fase-sem">Semanas ${esc(f.semanas)}${prog.fase === f ? ' · <strong>fase atual</strong>' : ''}</span>
            <strong class="fase-obj">${esc(f.objetivo)}</strong>
            <span>Musculação: ${esc(f.musculacao)}</span>
            <span>Cardio: ${esc(f.cardio_minutos)} min</span></li>`).join('')}</ol>
        <label class="check-linha"><input type="checkbox" data-config="ajustar_fase" ${Banco.config('ajustar_fase', true) ? 'checked' : ''}>
          Ajustar o número de séries do treino à fase atual</label>
      </section>

      <section class="card">
        <h2>Peso corporal</h2>
        <div class="tiles dentro">
          <div class="tile"><span class="rotulo">Atual</span><span class="valor">${atual ? fmtNum(atual) : '—'} <small>kg</small></span></div>
          <div class="tile"><span class="rotulo">Variação</span><span class="valor">${delta == null ? '—' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${fmtNum(Math.abs(delta))}`} <small>kg</small></span>
            <span class="sub">${primeiro && delta != null ? `desde ${fmtData(primeiro.data, { day: '2-digit', month: '2-digit' })}` : 'registre mais pesagens'}</span></div>
          <div class="tile"><span class="rotulo">IMC</span><span class="valor">${imc ? fmtNum(imc) : '—'}</span><span class="sub">${esc(faixaImc(imc))}</span></div>
        </div>
        <div class="form-linha">
          <label class="campo">Data<input type="date" id="peso-data" value="${Banco.hojeISO()}" max="${Banco.hojeISO()}"></label>
          <label class="campo">Peso (kg)<input type="text" id="peso-valor" inputmode="decimal" autocomplete="off" value="${atual != null ? fmtNum(atual) : ''}"></label>
          <button class="btn primario" data-acao="add-peso">Registrar</button>
        </div>
        ${pesagens.length >= 2 ? '<div id="grafico-peso" class="grafico-caixa"></div>' : '<p class="meta">Registre o peso a cada semana para ver o gráfico da evolução.</p>'}
        ${pesagens.length ? `<details class="tabela-dados"><summary>Ver pesagens (${pesagens.length})</summary>
          <table><thead><tr><th scope="col">Data</th><th scope="col">Peso</th><th scope="col"><span class="sr">Ações</span></th></tr></thead>
          <tbody>${[...pesagens].reverse().map(x => `<tr><td>${fmtData(x.data, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
            <td>${fmtNum(x.peso_kg)} kg</td><td><button class="btn-icone perigo" data-acao="del-peso" data-id="${x.id}" aria-label="Apagar pesagem">✕</button></td></tr>`).join('')}</tbody></table>
        </details>` : ''}
      </section>

      <section class="card">
        <h2>Cargas por exercício</h2>
        ${cargas.length ? `<ul class="lista-cargas">${cargas.map(c => `<li><a href="${linkExercicio(c.exercicio)}">
            ${miniatura(c.exercicio)}
            <span><strong>${esc(c.exercicio)}</strong><small>Última: ${fmtNum(c.ultimaCarga)} kg${c.ultimaData ? ` (${fmtData(c.ultimaData, { day: '2-digit', month: '2-digit' })})` : ''} · ${c.sessoes} ${c.sessoes === 1 ? 'treino' : 'treinos'}</small></span>
            <span class="melhor"><small>Melhor</small><strong>${fmtNum(c.melhor)} kg</strong></span></a></li>`).join('')}</ul>`
          : '<p class="meta">As cargas aparecem aqui depois do primeiro treino de musculação salvo.</p>'}
        <p class="nota">${esc(Banco.recomendacoes().progressao_carga || '')}</p>
      </section>`;
  }

  function posProgresso() {
    const el = $('#grafico-peso');
    if (!el) return null;
    const pontos = Banco.all('SELECT data, peso_kg FROM pesagens ORDER BY data').map(p => ({ data: p.data, valor: p.peso_kg }));
    return Grafico.linha(el, pontos, { unidade: 'kg', descricao: 'Evolução do peso corporal. Use as setas para ler cada pesagem.' });
  }

  /* ---------- tela: mais ---------- */

  function viewMais() {
    const p = Banco.perfil();
    const rec = Banco.recomendacoes();
    const cfg = (k, padrao = true) => (Banco.config(k, padrao) ? 'checked' : '');
    const notif = !('Notification' in window) ? 'Não suportado neste navegador'
      : Notification.permission === 'granted' ? 'Ativadas' : Notification.permission === 'denied' ? 'Bloqueadas no navegador' : 'Desativadas';
    const recItens = Object.entries(rec).filter(([k]) => k !== 'observacoes').map(([k, v]) => {
      const rotulo = ROTULOS_REC[k] || cap(k.replace(/_/g, ' '));
      const texto = k === 'sono_horas' ? `${v} horas por noite.` : v;
      return `<li><strong>${esc(rotulo)}</strong><span>${esc(texto)}</span></li>`;
    }).join('');
    return `<h1 class="titulo-pag">Mais</h1>
      <section class="card">
        <h2>Recomendações</h2>
        <ul class="recs">${recItens}</ul>
        ${rec.observacoes && rec.observacoes.length ? `<h3>Observações</h3><ul class="simples">${rec.observacoes.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
      </section>

      <section class="card">
        <h2>Perfil</h2>
        <div class="ed-grade">
          <label>Idade<input type="number" id="pf-idade" min="10" max="100" value="${p.idade ?? ''}"></label>
          <label>Peso inicial (kg)<input type="text" inputmode="decimal" id="pf-peso" value="${p.peso_kg != null ? fmtNum(p.peso_kg) : ''}"></label>
          <label>Altura (cm)<input type="number" id="pf-altura" value="${p.altura_cm ?? ''}"></label>
          <label>Tempo máximo por treino (min)<input type="number" id="pf-tempo" min="10" value="${p.tempo_maximo_treino_minutos ?? 60}"></label>
          <label class="largo">Objetivos (um por linha)<textarea id="pf-objetivos" rows="4">${esc(p.objetivos.join('\n'))}</textarea></label>
        </div>
        <div class="acoes"><button class="btn primario" data-acao="salvar-perfil">Salvar perfil</button></div>
      </section>

      <section class="card">
        <h2>Configurações</h2>
        <label class="check-linha"><input type="checkbox" data-config="som" ${cfg('som')}> Som no timer</label>
        <label class="check-linha"><input type="checkbox" data-config="vibrar" ${cfg('vibrar')}> Vibrar no fim do timer</label>
        <label class="check-linha"><input type="checkbox" data-config="auto_descanso" ${cfg('auto_descanso')}> Iniciar o descanso ao concluir uma série</label>
        <label class="check-linha"><input type="checkbox" data-config="tela_ligada" ${cfg('tela_ligada')}> Manter a tela ligada durante o treino</label>
        <label class="campo linha">Tema
          <select data-config="tema">${[['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([v, t]) =>
            `<option value="${v}" ${Banco.config('tema', 'auto') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="linha-config"><span>Notificações do timer: <strong>${notif}</strong></span>
          ${'Notification' in window && Notification.permission === 'default' ? '<button class="btn mini" data-acao="notificacoes">Ativar</button>' : ''}</div>
        <div class="linha-config"><span>Testar o alarme</span><button class="btn mini" data-acao="testar-som">Tocar</button></div>
      </section>

      <section class="card">
        <h2>Plano de treino</h2>
        <p class="meta">O plano usa o mesmo formato JSON da ficha. Importar substitui perfil, dias, exercícios, progressão e recomendações; o histórico é mantido.</p>
        <div class="acoes">
          <button class="btn" data-acao="exportar-plano">Exportar plano (.json)</button>
          <button class="btn" data-acao="importar-plano">Importar plano (.json)</button>
          <button class="btn fantasma" data-acao="restaurar-plano">Restaurar plano original</button>
        </div>
      </section>

      <section class="card">
        <h2>Backup</h2>
        <p class="meta">Os dados ficam salvos neste aparelho, em um banco SQLite. Exporte o arquivo .db para guardar uma cópia ou passar para outro aparelho (abre também no DB Browser for SQLite).</p>
        <div class="acoes">
          <button class="btn" data-acao="exportar-db">Exportar backup (.db)</button>
          <button class="btn" data-acao="importar-db">Importar backup (.db)</button>
          <button class="btn fantasma perigo" data-acao="apagar-tudo">Apagar todos os dados</button>
        </div>
      </section>

      <section class="card sobre-app">
        <h2>Sobre</h2>
        <p>Este app organiza a ficha, mas não substitui a avaliação de um profissional de educação física.</p>
        <p class="meta">Imagens dos exercícios: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">Free Exercise DB</a> (domínio público).
          Banco de dados: <a href="https://github.com/sql-js/sql.js" target="_blank" rel="noopener">sql.js</a> (SQLite, licença MIT).</p>
      </section>`;
  }

  function salvarPerfil() {
    const v = id => lerNumero($(id).value);
    const objetivos = $('#pf-objetivos').value.split('\n').map(s => s.trim()).filter(Boolean);
    Banco.run(`INSERT INTO perfil (id, idade, peso_kg, altura_cm, objetivos, tempo_maximo_treino_minutos) VALUES (1,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET idade = excluded.idade, peso_kg = excluded.peso_kg, altura_cm = excluded.altura_cm,
      objetivos = excluded.objetivos, tempo_maximo_treino_minutos = excluded.tempo_maximo_treino_minutos`,
      [v('#pf-idade'), v('#pf-peso'), v('#pf-altura'), JSON.stringify(objetivos), Math.round(v('#pf-tempo') || 60)]);
    toast('Perfil salvo.');
  }

  function naoEncontrado() {
    return '<section class="card vazio"><h1>Página não encontrada</h1><div class="acoes"><a class="btn primario" href="#/hoje">Ir para hoje</a></div></section>';
  }

  /* ---------- configurações ---------- */

  function aplicarConfig() {
    Timer.opcoes.som = Banco.config('som', true);
    Timer.opcoes.vibrar = Banco.config('vibrar', true);
    const tema = Banco.config('tema', 'auto');
    if (tema === 'claro') document.documentElement.dataset.theme = 'light';
    else if (tema === 'escuro') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('treino-tema', tema); } catch (e) { /* sem armazenamento */ }
  }

  /* ---------- timer: barra inferior ---------- */

  const ROTULO_MODO = { descanso: 'Descanso', cardio: 'Cardio', trabalho: 'Em execução', livre: 'Timer' };

  function atualizarDock(estado, restante) {
    const dock = $('#timer-dock');
    if (!estado) {
      dock.hidden = true;
      dock.classList.remove('cheio');
      document.body.classList.remove('com-timer');
      return;
    }
    dock.hidden = false;
    document.body.classList.add('com-timer');
    dock.dataset.modo = estado.modo;
    dock.classList.toggle('pausado', estado.pausado);
    $('.dock-tempo', dock).textContent = fmtTempo(Math.ceil(restante));
    $('.dock-modo', dock).textContent = ROTULO_MODO[estado.modo] + (estado.pausado ? ' (pausado)' : '');
    $('.dock-rotulo', dock).textContent = estado.rotulo;
    const anel = $('.anel-progresso', dock);
    const c = 2 * Math.PI * 44;
    anel.style.strokeDasharray = c;
    anel.style.strokeDashoffset = c * (1 - (estado.total ? restante / estado.total : 0));
    const pausa = $('.dock-pausa', dock);
    pausa.textContent = estado.pausado ? '▶' : '❚❚';
    pausa.setAttribute('aria-label', estado.pausado ? 'Continuar' : 'Pausar');
    $('.dock-parar', dock).textContent = estado.modo === 'descanso' ? 'Pular' : 'Parar';
  }

  async function timerLivre() {
    const presets = [30, 45, 60, 90, 120, 180];
    const r = await dialogo({
      titulo: 'Timer',
      corpo: `<div class="presets">${presets.map(s => `<button class="btn" value="${s}">${fmtTempo(s)}</button>`).join('')}</div>
        <label class="campo">Outro tempo (min:seg)<input id="timer-custom" placeholder="2:30" inputmode="numeric"></label>`,
      botoes: [{ valor: '', texto: 'Fechar' }, { valor: 'custom', texto: 'Iniciar', classe: 'primario' }]
    });
    let seg = Number(r.valor);
    if (r.valor === 'custom') {
      const txt = $('#timer-custom', r.el).value.trim();
      const [a, b] = txt.split(':');
      seg = b !== undefined ? Number(a) * 60 + Number(b) : Number(a) * 60;
    }
    if (seg > 0) Timer.iniciar({ modo: 'livre', rotulo: 'Timer livre', segundos: Math.round(seg) });
  }

  /* ---------- eventos ---------- */

  const acoes = {
    iniciar: el => iniciarSessao(Number(el.dataset.dia)),
    alternar: el => {
      const id = Number(el.dataset.ex);
      if (abertos.has(id)) abertos.delete(id); else abertos.add(id);
      const card = $(`#ex-${id}`);
      const corpo = $('.ex-corpo', card);
      corpo.hidden = !abertos.has(id);
      card.classList.toggle('aberto', abertos.has(id));
      el.setAttribute('aria-expanded', abertos.has(id));
    },
    serie: el => alternarSerie(Number(el.dataset.ex), Number(el.dataset.serie)),
    'serie-tempo': el => iniciarSerieTempo(Number(el.dataset.ex), Number(el.dataset.serie)),
    'cardio-iniciar': el => iniciarCardio(Number(el.dataset.ex)),
    'cardio-concluir': el => concluirCardio(Number(el.dataset.ex)),
    'cardio-feito': el => concluirCardio(Number(el.dataset.ex)),
    finalizar: () => finalizarSessao(),
    descartar: async () => {
      const s = sessaoAtiva();
      if (!s) return;
      if (await confirmar('Descartar treino', 'As séries registradas neste treino serão apagadas.', { ok: 'Descartar', perigo: true })) {
        descartarSessao(s.id);
        abertos.clear();
        location.hash = '#/hoje';
      }
    },
    voltar: () => { if (navegacoes > 0) history.back(); else location.hash = '#/semana'; },
    pose: el => {
      const m = $('.visor .midia');
      if (!m) return;
      m.classList.remove('pose-0', 'pose-1');
      if (el.dataset.pose !== 'anim') m.classList.add('pose-' + el.dataset.pose);
    },
    'apagar-sessao': async el => {
      if (await confirmar('Apagar treino', 'Este treino e suas séries serão apagados do histórico.', { ok: 'Apagar', perigo: true })) {
        const id = Number(el.dataset.id);
        Banco.transacao(() => {
          Banco.run('DELETE FROM registros WHERE sessao_id = ?', [id]);
          Banco.run('DELETE FROM sessoes WHERE id = ?', [id]);
        });
        toast('Treino apagado.');
        location.hash = '#/historico';
      }
    },
    'add-peso': () => {
      const data = $('#peso-data').value;
      const peso = lerNumero($('#peso-valor').value);
      if (!data || !peso || peso < 20 || peso > 400) { toast('Informe uma data e um peso válido.'); return; }
      Banco.run('INSERT INTO pesagens (data, peso_kg) VALUES (?, ?) ON CONFLICT(data) DO UPDATE SET peso_kg = excluded.peso_kg', [data, peso]);
      toast('Pesagem registrada.');
      render();
    },
    'del-peso': el => { Banco.run('DELETE FROM pesagens WHERE id = ?', [Number(el.dataset.id)]); render(); },
    'salvar-perfil': () => { salvarPerfil(); render(); },
    notificacoes: async () => { await Notification.requestPermission(); render(); },
    'testar-som': () => Timer.alarme(),
    'exportar-plano': () => baixar('plano-treino.json', JSON.stringify(Banco.planoJSON(), null, 2), 'application/json'),
    'importar-plano': async () => {
      if (sessaoAtiva()) { toast('Finalize ou descarte o treino em andamento antes de trocar o plano.'); return; }
      const arq = await escolherArquivo('.json,application/json');
      if (!arq) return;
      try {
        const plano = JSON.parse(await arq.text());
        if (!(await confirmar('Importar plano', `Substituir o plano atual pelo de "${arq.name}"? O histórico será mantido.`, { ok: 'Importar' }))) return;
        Banco.carregarPlano(plano);
        toast('Plano importado.');
        location.hash = '#/semana';
      } catch (e) {
        toast('Não foi possível importar: ' + e.message);
      }
    },
    'restaurar-plano': async () => {
      if (sessaoAtiva()) { toast('Finalize ou descarte o treino em andamento antes de trocar o plano.'); return; }
      if (!(await confirmar('Restaurar plano original', 'O plano volta para a ficha original. O histórico será mantido.', { ok: 'Restaurar' }))) return;
      Banco.carregarPlano(PLANO_PADRAO);
      toast('Plano original restaurado.');
      render();
    },
    'exportar-db': async () => {
      await Banco.salvarAgora();
      baixar(`treino-backup-${Banco.hojeISO()}.db`, Banco.exportar(), 'application/vnd.sqlite3');
    },
    'importar-db': async () => {
      const arq = await escolherArquivo('.db,.sqlite,.sqlite3,application/vnd.sqlite3,application/octet-stream');
      if (!arq) return;
      if (!(await confirmar('Importar backup', `Substituir todos os dados deste aparelho pelo backup "${arq.name}"?`, { ok: 'Importar', perigo: true }))) return;
      try {
        Timer.parar();
        await Banco.importar(new Uint8Array(await arq.arrayBuffer()));
        abertos.clear();
        aplicarConfig();
        toast('Backup importado.');
        location.hash = '#/hoje';
        render();
      } catch (e) {
        toast(e.message);
      }
    },
    'apagar-tudo': async () => {
      if (!(await confirmar('Apagar todos os dados', 'Histórico, pesagens e alterações no plano serão apagados. Exporte um backup antes, se quiser guardar.', { ok: 'Apagar tudo', perigo: true }))) return;
      Timer.parar();
      await Banco.apagarTudo();
      abertos.clear();
      aplicarConfig();
      toast('Dados apagados.');
      location.hash = '#/hoje';
      render();
    },
    'ed-adicionar': () => {
      $('#ed-lista').insertAdjacentHTML('beforeend', campoExercicio({ series: 3, repeticoes: '12', descanso_segundos: 60 }));
      const novo = $('#ed-lista .ed-ex:last-child .ed-nome');
      novo.focus();
    },
    'ed-subir': el => { const fs = el.closest('.ed-ex'); if (fs.previousElementSibling) fs.parentNode.insertBefore(fs, fs.previousElementSibling); },
    'ed-descer': el => { const fs = el.closest('.ed-ex'); if (fs.nextElementSibling) fs.parentNode.insertBefore(fs.nextElementSibling, fs); },
    'ed-remover': el => el.closest('.ed-ex').remove(),
    'ed-salvar': () => salvarEdicao(),
    'timer-livre': () => timerLivre(),
    'timer-expandir': () => $('#timer-dock').classList.toggle('cheio'),
    'timer-menos': () => Timer.ajustar(-15),
    'timer-mais': () => Timer.ajustar(15),
    'timer-pausa': () => (Timer.estado && Timer.estado.pausado ? Timer.retomar() : Timer.pausar()),
    'timer-parar': () => {
      Timer.parar();
      if (rotaAtual()[0] === 'treino') render();
    }
  };

  function aoClicar(e) {
    const el = e.target.closest('[data-acao]');
    if (!el || el.disabled) return;
    const fn = acoes[el.dataset.acao];
    if (!fn) return;
    e.preventDefault();
    fn(el);
  }

  function aoDigitar(e) {
    const el = e.target;
    if (el.dataset && el.dataset.campo) {
      const chave = `${el.dataset.ex}-${el.dataset.serie}`;
      rascunho[chave] = { ...(rascunho[chave] || {}), [el.dataset.campo]: lerNumero(el.value) };
    }
  }

  function aoMudar(e) {
    const el = e.target;
    if (el.dataset && el.dataset.config) {
      const valor = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.config === 'data_inicio' && !valor) return;
      Banco.setConfig(el.dataset.config, valor);
      aplicarConfig();
      if (['data_inicio', 'ajustar_fase'].includes(el.dataset.config)) render();
    }
  }

  /* ---------- navegação ---------- */

  function rotaAtual() {
    const h = location.hash.replace(/^#\/?/, '') || 'hoje';
    return h.split('/');
  }

  function render() {
    if (limpezaTela) { limpezaTela(); limpezaTela = null; }
    const [pag, a, b] = rotaAtual();
    const rota = location.hash;
    let html;
    let depois = null;
    switch (pag) {
      case 'hoje': html = viewHoje(); break;
      case 'semana': html = viewSemana(); break;
      case 'dia': html = b === 'editar' ? viewEditarDia(Number(a)) : viewDia(Number(a)); break;
      case 'treino': html = viewTreino(); break;
      case 'exercicio': {
        const bruto = location.hash.split('/').slice(2).join('/');
        let nome = bruto;
        try { nome = decodeURIComponent(bruto); } catch (e) { /* já decodificado */ }
        html = viewExercicio(nome);
        break;
      }
      case 'historico': html = a ? viewSessao(Number(a)) : viewHistorico(); break;
      case 'progresso': html = viewProgresso(); depois = posProgresso; break;
      case 'mais': html = viewMais(); break;
      default: html = viewHoje();
    }
    const main = $('#conteudo');
    main.innerHTML = html;
    const secao = { dia: 'semana', exercicio: 'semana', treino: 'hoje' }[pag] || pag;
    $$('.nav a').forEach(l => {
      if (l.dataset.pag === secao) l.setAttribute('aria-current', 'page');
      else l.removeAttribute('aria-current');
    });
    if (depois) limpezaTela = depois();
    if (rota !== rotaAnterior) {
      window.scrollTo(0, 0);
      if (pag === 'treino') {
        const aberto = $('.card.ex.aberto');
        if (aberto && aberto !== $('.card.ex')) aberto.scrollIntoView({ block: 'start' });
      }
      rotaAnterior = rota;
    }
    atualizarRelogios();
  }

  async function iniciar() {
    try {
      await Banco.abrir();
    } catch (e) {
      $('#conteudo').innerHTML = `<section class="card vazio"><h1>Não foi possível abrir o banco de dados</h1>
        <p>${esc(e.message)}</p><p class="meta">Abra o site por um endereço http(s), por exemplo o GitHub Pages ou um servidor local.</p></section>`;
      return;
    }
    aplicarConfig();
    Timer.aoTerminar = timerTerminou;
    Timer.ouvir(atualizarDock);
    document.addEventListener('click', aoClicar);
    document.addEventListener('input', aoDigitar);
    document.addEventListener('change', aoMudar);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#timer-dock').classList.contains('cheio')) $('#timer-dock').classList.remove('cheio');
    });
    window.addEventListener('hashchange', () => { navegacoes++; render(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Banco.salvarAgora();
      else if (sessaoAtiva() && rotaAtual()[0] === 'treino') pedirWakeLock();
    });
    window.addEventListener('pagehide', () => Banco.salvarAgora());
    setInterval(atualizarRelogios, 1000);
    Timer.restaurar();
    render();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { iniciar };
})();

App.iniciar();
