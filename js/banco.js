/* Banco de dados SQLite no navegador (sql.js), salvo no IndexedDB do aparelho. */

const Banco = (() => {
  const NOME_ARQUIVO = 'treino.db';
  const VERSAO_SCHEMA = 1;
  let db = null;
  let salvarPendente = false;

  const SCHEMA = `
    CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);
    CREATE TABLE IF NOT EXISTS perfil (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      idade INTEGER, peso_kg REAL, altura_cm REAL,
      objetivos TEXT, tempo_maximo_treino_minutos INTEGER
    );
    CREATE TABLE IF NOT EXISTS dias (
      id INTEGER PRIMARY KEY, ordem INTEGER, dia TEXT, tipo TEXT,
      grupo_muscular TEXT, duracao_estimada_minutos INTEGER
    );
    CREATE TABLE IF NOT EXISTS exercicios (
      id INTEGER PRIMARY KEY, dia_id INTEGER NOT NULL, ordem INTEGER,
      aquecimento INTEGER NOT NULL DEFAULT 0, nome TEXT NOT NULL,
      series INTEGER, repeticoes TEXT, descanso_segundos INTEGER,
      duracao_minutos REAL, duracao_por_serie_segundos INTEGER, intensidade TEXT
    );
    CREATE TABLE IF NOT EXISTS progressao (
      id INTEGER PRIMARY KEY, ordem INTEGER, semanas TEXT,
      musculacao TEXT, cardio_minutos TEXT, objetivo TEXT
    );
    CREATE TABLE IF NOT EXISTS recomendacoes (chave TEXT PRIMARY KEY, valor TEXT);
    CREATE TABLE IF NOT EXISTS sessoes (
      id INTEGER PRIMARY KEY, dia_id INTEGER, dia TEXT, tipo TEXT, grupos TEXT,
      inicio TEXT NOT NULL, fim TEXT, duracao_segundos INTEGER, observacoes TEXT
    );
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY, sessao_id INTEGER NOT NULL, exercicio_id INTEGER,
      exercicio TEXT NOT NULL, serie INTEGER NOT NULL, repeticoes INTEGER,
      carga_kg REAL, duracao_segundos INTEGER, feito_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_registros_sessao ON registros(sessao_id);
    CREATE INDEX IF NOT EXISTS idx_registros_exercicio ON registros(exercicio);
    CREATE TABLE IF NOT EXISTS pesagens (id INTEGER PRIMARY KEY, data TEXT UNIQUE NOT NULL, peso_kg REAL NOT NULL);
  `;

  /* ---------- armazenamento do arquivo .db ---------- */

  function abrirIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('treino-semanal', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('arquivos');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function lerArquivo() {
    try {
      const idb = await abrirIDB();
      return await new Promise((resolve, reject) => {
        const req = idb.transaction('arquivos').objectStore('arquivos').get(NOME_ARQUIVO);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      const b64 = localStorage.getItem(NOME_ARQUIVO);
      return b64 ? Uint8Array.from(atob(b64), c => c.charCodeAt(0)) : null;
    }
  }

  async function gravarArquivo(bytes) {
    try {
      const idb = await abrirIDB();
      await new Promise((resolve, reject) => {
        const tx = idb.transaction('arquivos', 'readwrite');
        tx.objectStore('arquivos').put(bytes, NOME_ARQUIVO);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      localStorage.setItem(NOME_ARQUIVO, btoa(bin));
    }
  }

  function carregarScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Falha ao carregar ' + src));
      document.head.appendChild(s);
    });
  }

  async function carregarSqlJs() {
    try {
      await carregarScript('vendor/sql-wasm.js');
      return await initSqlJs({ locateFile: arquivo => 'vendor/' + arquivo });
    } catch (e) {
      // Sem WebAssembly (ou aberto direto do arquivo): usa a versão em JavaScript puro.
      await carregarScript('vendor/sql-asm.js');
      return await initSqlJs();
    }
  }

  /* ---------- consultas ---------- */

  function run(sql, params = []) {
    db.run(sql, params);
    agendarSalvar();
  }

  function all(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const linhas = [];
    while (stmt.step()) linhas.push(stmt.getAsObject());
    stmt.free();
    return linhas;
  }

  function get(sql, params = []) {
    return all(sql, params)[0] || null;
  }

  function inserir(sql, params = []) {
    db.run(sql, params);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    agendarSalvar();
    return id;
  }

  function transacao(fn) {
    db.run('BEGIN');
    try {
      fn();
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
    agendarSalvar();
  }

  /* Agrupa as escritas de uma mesma ação e grava logo em seguida (não espera: fechar a página não perde dados). */
  function agendarSalvar() {
    if (salvarPendente) return;
    salvarPendente = true;
    queueMicrotask(salvarAgora);
  }

  async function salvarAgora() {
    salvarPendente = false;
    if (db) await gravarArquivo(db.export());
  }

  /* ---------- configurações ---------- */

  function config(chave, padrao = null) {
    const linha = get('SELECT valor FROM config WHERE chave = ?', [chave]);
    if (!linha) return padrao;
    try { return JSON.parse(linha.valor); } catch (e) { return linha.valor; }
  }

  function setConfig(chave, valor) {
    run('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
      [chave, JSON.stringify(valor)]);
  }

  /* ---------- plano de treino (JSON ⇄ tabelas) ---------- */

  function validarPlano(plano) {
    if (!plano || typeof plano !== 'object') throw new Error('O arquivo não contém um objeto JSON.');
    if (!Array.isArray(plano.treino_semanal)) throw new Error('Faltou a lista "treino_semanal".');
    plano.treino_semanal.forEach((d, i) => {
      if (!d || !d.dia) throw new Error(`O dia ${i + 1} não tem o campo "dia".`);
      if (d.exercicios && !Array.isArray(d.exercicios)) throw new Error(`"exercicios" de ${d.dia} não é uma lista.`);
      (d.exercicios || []).forEach(ex => {
        if (!ex || !ex.nome) throw new Error(`Há um exercício sem nome em ${d.dia}.`);
      });
    });
  }

  function num(v) {
    const n = Number(v);
    return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n;
  }

  function inserirExercicio(diaId, ordem, ex, aquecimento) {
    db.run(`INSERT INTO exercicios (dia_id, ordem, aquecimento, nome, series, repeticoes, descanso_segundos,
              duracao_minutos, duracao_por_serie_segundos, intensidade) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [diaId, ordem, aquecimento ? 1 : 0, String(ex.nome), num(ex.series),
        ex.repeticoes != null ? String(ex.repeticoes) : null, num(ex.descanso_segundos),
        num(ex.duracao_minutos), num(ex.duracao_por_serie_segundos), ex.intensidade || null]);
  }

  function carregarPlano(plano) {
    validarPlano(plano);
    transacao(() => {
      db.run('DELETE FROM dias');
      db.run('DELETE FROM exercicios');
      db.run('DELETE FROM progressao');
      db.run('DELETE FROM recomendacoes');
      if (plano.perfil) {
        const p = plano.perfil;
        db.run('DELETE FROM perfil');
        db.run('INSERT INTO perfil (id, idade, peso_kg, altura_cm, objetivos, tempo_maximo_treino_minutos) VALUES (1,?,?,?,?,?)',
          [num(p.idade), num(p.peso_kg), num(p.altura_cm), JSON.stringify(p.objetivos || []), num(p.tempo_maximo_treino_minutos) || 60]);
      }
      plano.treino_semanal.forEach((d, i) => {
        db.run('INSERT INTO dias (ordem, dia, tipo, grupo_muscular, duracao_estimada_minutos) VALUES (?,?,?,?,?)',
          [i, String(d.dia), d.tipo || 'Treino', JSON.stringify(d.grupo_muscular || []), num(d.duracao_estimada_minutos) || 0]);
        const diaId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        if (d.aquecimento && d.aquecimento.nome) inserirExercicio(diaId, 0, d.aquecimento, true);
        (d.exercicios || []).forEach((ex, j) => inserirExercicio(diaId, j + 1, ex, false));
      });
      (plano.progressao || []).forEach((f, i) => {
        db.run('INSERT INTO progressao (ordem, semanas, musculacao, cardio_minutos, objetivo) VALUES (?,?,?,?,?)',
          [i, String(f.semanas || ''), f.musculacao || '', String(f.cardio_minutos || ''), f.objetivo || '']);
      });
      Object.entries(plano.recomendacoes || {}).forEach(([chave, valor]) => {
        db.run('INSERT INTO recomendacoes (chave, valor) VALUES (?, ?)', [chave, JSON.stringify(valor)]);
      });
    });
  }

  function exercicioParaJSON(e) {
    const o = { nome: e.nome };
    if (e.series != null) o.series = e.series;
    if (e.repeticoes != null) o.repeticoes = e.repeticoes;
    if (e.duracao_minutos != null) o.duracao_minutos = e.duracao_minutos;
    if (e.duracao_por_serie_segundos != null) o.duracao_por_serie_segundos = e.duracao_por_serie_segundos;
    if (e.descanso_segundos != null) o.descanso_segundos = e.descanso_segundos;
    if (e.intensidade) o.intensidade = e.intensidade;
    return o;
  }

  function planoJSON() {
    const p = perfil();
    const plano = {
      perfil: {
        idade: p.idade, peso_kg: p.peso_kg, altura_cm: p.altura_cm,
        objetivos: p.objetivos, tempo_maximo_treino_minutos: p.tempo_maximo_treino_minutos
      },
      treino_semanal: dias().map(d => {
        const o = { dia: d.dia, tipo: d.tipo };
        if (d.grupo_muscular.length) o.grupo_muscular = d.grupo_muscular;
        o.duracao_estimada_minutos = d.duracao_estimada_minutos;
        const lista = exerciciosDoDia(d.id);
        const aq = lista.find(e => e.aquecimento);
        if (aq) o.aquecimento = exercicioParaJSON(aq);
        o.exercicios = lista.filter(e => !e.aquecimento).map(exercicioParaJSON);
        return o;
      }),
      progressao: all('SELECT semanas, musculacao, cardio_minutos, objetivo FROM progressao ORDER BY ordem'),
      recomendacoes: recomendacoes()
    };
    return plano;
  }

  /* ---------- leituras do plano ---------- */

  function perfil() {
    const p = get('SELECT * FROM perfil WHERE id = 1') || { idade: null, peso_kg: null, altura_cm: null, objetivos: '[]', tempo_maximo_treino_minutos: 60 };
    return { ...p, objetivos: JSON.parse(p.objetivos || '[]') };
  }

  function dias() {
    return all('SELECT * FROM dias ORDER BY ordem').map(d => ({ ...d, grupo_muscular: JSON.parse(d.grupo_muscular || '[]') }));
  }

  function dia(id) {
    const d = get('SELECT * FROM dias WHERE id = ?', [id]);
    return d ? { ...d, grupo_muscular: JSON.parse(d.grupo_muscular || '[]') } : null;
  }

  function exerciciosDoDia(diaId) {
    return all('SELECT * FROM exercicios WHERE dia_id = ? ORDER BY aquecimento DESC, ordem, id', [diaId]);
  }

  function progressao() {
    return all('SELECT * FROM progressao ORDER BY ordem');
  }

  function recomendacoes() {
    const o = {};
    all('SELECT chave, valor FROM recomendacoes').forEach(r => { o[r.chave] = JSON.parse(r.valor); });
    return o;
  }

  /* ---------- inicialização ---------- */

  async function abrir() {
    const SQL = await carregarSqlJs();
    const bytes = await lerArquivo();
    db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    db.exec(SCHEMA);
    if (!get('SELECT 1 FROM dias LIMIT 1')) semear();
    setConfig('versao_schema', VERSAO_SCHEMA);
    await salvarAgora();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    window.SQL_CLASSE = SQL;
  }

  /* Primeiro uso: plano padrão, início do programa hoje e o peso do perfil como primeira pesagem. */
  function semear() {
    carregarPlano(PLANO_PADRAO);
    setConfig('data_inicio', hojeISO());
    const p = perfil();
    if (p.peso_kg) run('INSERT OR IGNORE INTO pesagens (data, peso_kg) VALUES (?, ?)', [hojeISO(), p.peso_kg]);
  }

  function hojeISO(data = new Date()) {
    const d = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }

  function exportar() {
    return db.export();
  }

  async function importar(bytes) {
    const novo = new window.SQL_CLASSE.Database(bytes);
    try {
      novo.exec('SELECT count(*) FROM dias');
      novo.exec('SELECT count(*) FROM sessoes');
    } catch (e) {
      novo.close();
      throw new Error('Este arquivo não é um backup do Treino Semanal.');
    }
    db.close();
    db = novo;
    db.exec(SCHEMA);
    await salvarAgora();
  }

  async function apagarTudo() {
    db.close();
    db = new window.SQL_CLASSE.Database();
    db.exec(SCHEMA);
    semear();
    await salvarAgora();
  }

  return {
    abrir, run, all, get, inserir, transacao, salvarAgora, config, setConfig,
    carregarPlano, planoJSON, perfil, dias, dia, exerciciosDoDia, progressao, recomendacoes,
    exportar, importar, apagarTudo, hojeISO
  };
})();
