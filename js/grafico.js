/* Gráfico de linha (SVG) para o peso corporal, com cruz de leitura e teclado. */

const Grafico = (() => {
  function passoBonito(intervalo, alvo = 4) {
    const bruto = intervalo / alvo;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const n = bruto / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }

  const fmt = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const tempo = iso => new Date(iso + 'T00:00:00').getTime();
  const dataCurta = iso => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const dataLonga = iso => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

  /* pontos: [{ data: 'AAAA-MM-DD', valor: número }] em ordem de data */
  function linha(container, pontos, { unidade = 'kg', descricao = 'Gráfico' } = {}) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'grafico';
    const tip = document.createElement('div');
    tip.className = 'grafico-tip';
    tip.hidden = true;
    const tipValor = document.createElement('strong');
    const tipData = document.createElement('span');
    tip.append(tipValor, tipData);
    container.appendChild(wrap);

    let geo = null;
    let selecionado = null;

    function desenhar() {
      const W = Math.max(260, Math.round(wrap.clientWidth));
      const H = 220;
      const m = { t: 16, r: 64, b: 30, l: 40 };
      const xs = pontos.map(p => tempo(p.data));
      const vs = pontos.map(p => p.valor);
      let min = Math.min(...vs);
      let max = Math.max(...vs);
      if (max - min < 2) { min -= 1; max += 1; }
      const passo = passoBonito(max - min);
      const y0 = Math.floor(min / passo) * passo;
      const y1 = Math.ceil(max / passo) * passo;
      let x0 = Math.min(...xs);
      let x1 = Math.max(...xs);
      if (x1 === x0) { x0 -= 3 * 864e5; x1 += 3 * 864e5; }
      const X = t => m.l + (t - x0) / (x1 - x0) * (W - m.l - m.r);
      const Y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);

      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" tabindex="0" role="img" aria-label="${descricao}">`;
      for (let v = y0; v <= y1 + 1e-9; v += passo) {
        const y = Y(v).toFixed(1);
        s += `<line class="g-grade" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/>`;
        s += `<text class="g-eixo" x="${m.l - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
      }
      const n = pontos.length;
      const marcas = [...new Set([0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1])];
      marcas.forEach(i => {
        const ancora = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        s += `<text class="g-eixo" x="${X(xs[i]).toFixed(1)}" y="${H - 8}" text-anchor="${ancora}">${dataCurta(pontos[i].data)}</text>`;
      });
      const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(p.valor).toFixed(1)}`).join('');
      s += `<line class="g-cruz" y1="${m.t}" y2="${H - m.b}" x1="0" x2="0" visibility="hidden"/>`;
      s += `<path class="g-linha" d="${d}"/>`;
      pontos.forEach((p, i) => {
        if (n <= 30 || i === n - 1) s += `<circle class="g-ponto" cx="${X(xs[i]).toFixed(1)}" cy="${Y(p.valor).toFixed(1)}" r="4"/>`;
      });
      s += `<circle class="g-foco" r="6" visibility="hidden"/>`;
      const ult = pontos[n - 1];
      s += `<text class="g-fim" x="${(X(xs[n - 1]) + 10).toFixed(1)}" y="${(Y(ult.valor) + 4).toFixed(1)}">${fmt(ult.valor)} ${unidade}</text>`;
      s += `<rect class="g-alvo" x="${m.l}" y="0" width="${W - m.l - m.r + 20}" height="${H}" fill="transparent"/>`;
      s += '</svg>';
      wrap.innerHTML = s;
      wrap.appendChild(tip);
      geo = { X, Y, xs, W, m, H };
      if (selecionado != null) mostrar(selecionado);
    }

    function mostrar(i) {
      selecionado = i;
      const svg = wrap.querySelector('svg');
      const p = pontos[i];
      const x = geo.X(geo.xs[i]);
      const y = geo.Y(p.valor);
      const cruz = svg.querySelector('.g-cruz');
      cruz.setAttribute('x1', x);
      cruz.setAttribute('x2', x);
      cruz.setAttribute('visibility', 'visible');
      const foco = svg.querySelector('.g-foco');
      foco.setAttribute('cx', x);
      foco.setAttribute('cy', y);
      foco.setAttribute('visibility', 'visible');
      tipValor.textContent = `${fmt(p.valor)} ${unidade}`;
      tipData.textContent = dataLonga(p.data);
      tip.hidden = false;
      const larg = tip.offsetWidth;
      const esq = Math.min(Math.max(0, x - larg / 2), geo.W - larg);
      tip.style.left = `${esq}px`;
      tip.style.top = `${Math.max(0, y - 58)}px`;
    }

    function esconder() {
      selecionado = null;
      tip.hidden = true;
      const svg = wrap.querySelector('svg');
      svg.querySelector('.g-cruz').setAttribute('visibility', 'hidden');
      svg.querySelector('.g-foco').setAttribute('visibility', 'hidden');
    }

    function maisProximo(clientX) {
      const r = wrap.querySelector('svg').getBoundingClientRect();
      const x = clientX - r.left;
      let melhor = 0;
      geo.xs.forEach((t, i) => {
        if (Math.abs(geo.X(t) - x) < Math.abs(geo.X(geo.xs[melhor]) - x)) melhor = i;
      });
      return melhor;
    }

    wrap.addEventListener('pointermove', e => mostrar(maisProximo(e.clientX)));
    wrap.addEventListener('pointerdown', e => mostrar(maisProximo(e.clientX)));
    wrap.addEventListener('pointerleave', esconder);
    wrap.addEventListener('focusout', esconder);
    wrap.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const atual = selecionado ?? pontos.length - 1;
      const novo = e.key === 'Home' ? 0 : e.key === 'End' ? pontos.length - 1
        : Math.min(pontos.length - 1, Math.max(0, atual + (e.key === 'ArrowLeft' ? -1 : 1)));
      mostrar(novo);
    });

    let quadro = null;
    const obs = new ResizeObserver(() => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(desenhar);
    });
    obs.observe(wrap);
    desenhar();
    return () => obs.disconnect();
  }

  return { linha };
})();
