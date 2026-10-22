/*
 * peixe.js — Desenho dos peixes no canvas (usado pelo jogo e pelo painel admin).
 * Formas simples a partir do campo "visual" de especies.json:
 *   forma: fusiforme | alto | alongado | achatado | bagre | anguiliforme | tuvira | gobio
 *   cor / detalhe: cores do corpo e das nadadeiras
 *   barbilhao: true/false (se não vier, só o formato "bagre" tem barbilhões)
 */
'use strict';
const Peixe = (() => {
  const FORMAS = {
    fusiforme: { h: 0.2,  cauda: 'garfo',   dorsal: 'pequena' },
    alto:      { h: 0.32, cauda: 'reta',    dorsal: 'longa' },
    alongado:  { h: 0.15, cauda: 'redonda', dorsal: 'pequena' },
    achatado:  { h: 0.17, cauda: 'garfo',   dorsal: 'vela', placas: true, barriga: true },
    bagre:     { h: 0.15, cauda: 'garfo',   dorsal: 'pequena' },
    gobio:     { h: 0.13, cauda: 'redonda', dorsal: 'dupla', barriga: true }
  };

  function clarear(hex, q) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(c + (255 - c) * q);
    return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
  }

  const temBarbilhao = (v) => (v.barbilhao != null ? !!v.barbilhao : v.forma === 'bagre');

  function olho(ctx, x, y, L) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, L * 0.035, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(x + L * 0.008, y, L * 0.02, 0, 6.3); ctx.fill();
  }

  // barbilhões saindo da boca (x, y)
  function barbilhoes(ctx, x, y, L, h, det, t) {
    ctx.strokeStyle = det; ctx.lineWidth = Math.max(1, L * 0.01); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + L * 0.12, y + h * (0.15 + i * 0.3), x + L * (0.06 + 0.07 * (i + 1)), y + h * (0.75 + i * 0.4) + Math.sin(t * 4 + i) * h * 0.2);
      ctx.stroke();
    }
  }

  function gradiente(ctx, cor, h, pos = 0.55) {
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, cor); g.addColorStop(pos, cor); g.addColorStop(1, clarear(cor, 0.55));
    return g;
  }

  // Anguiliforme (muçum, cambeva): corpo comprido que ondula, nadadeira baixa e contínua até a ponta
  function anguiliforme(ctx, v, L, t, cor, det) {
    const h = L * 0.075, N = 40;
    const eixo = (s) => ({ x: L * (0.5 - s), y: Math.sin(s * 7 - t * 6) * h * 0.9 * s * s });
    // focinho arredondado: a grossura cresce como um quarto de círculo até s = 0.12
    const grossura = (s) => (s < 0.12 ? Math.sqrt(1 - (1 - s / 0.12) ** 2) : 1 - ((s - 0.12) / 0.88) * 0.8) * h;
    const contorno = (extra, ini) => {
      const cima = [], baixo = [];
      for (let i = 0; i <= N; i++) {
        const s = ini + (1 - ini) * (i / N), p = eixo(s), g = grossura(s) * extra(s);
        cima.push([p.x, p.y - g]); baixo.push([p.x, p.y + g]);
      }
      ctx.beginPath();
      cima.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      baixo.reverse().forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
    };
    // nadadeira contínua (dorsal + anal unidas na ponta do rabo)
    ctx.fillStyle = det; ctx.globalAlpha = 0.45;
    contorno((s) => 1 + 0.6 * Math.min(1, (s - 0.3) / 0.4), 0.3); ctx.fill();   // a nadadeira cresce até a ponta
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradiente(ctx, cor, h);
    contorno(() => 1, 0); ctx.fill();
    olho(ctx, L * 0.43, -h * 0.25, L * 0.7);
    if (temBarbilhao(v)) barbilhoes(ctx, L * 0.5, h * 0.2, L * 0.7, h * 1.6, det, t);
  }

  // Tuvira (peixe-elétrico): corpo em faca, sem dorsal e sem caudal, só a nadadeira anal longa ondulando
  function tuvira(ctx, v, L, t, cor, det) {
    const h = L * 0.12, N = 40;
    // focinho arredondado (quarto de círculo) e corpo afinando até a ponta do rabo
    const redondo = (s, ate) => Math.sqrt(1 - (1 - s / ate) ** 2);
    const cima = (s) => -h * (s < 0.18 ? 0.85 * redondo(s, 0.18) : 0.85 * (1 - (s - 0.18) / 0.82) ** 1.3);
    const baixo = (s) => h * (s < 0.22 ? redondo(s, 0.22) : (1 - (s - 0.22) / 0.78) ** 1.1);
    const x = (s) => L * (0.5 - s);
    const onda = (s) => Math.sin(s * 5 - t * 4) * h * 0.25 * s * s;   // só a pontinha do rabo balança
    // nadadeira anal: fita da barriga quase até a ponta, com ondas correndo para trás
    ctx.fillStyle = det; ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const s = 0.2 + 0.72 * (i / N);
      const alt = h * 0.55 * (1 - (s - 0.2) / 0.72 * 0.6) * (0.75 + 0.25 * Math.sin(s * 34 - t * 12));
      const px = x(s), py = baixo(s) + onda(s) + alt;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    for (let i = N; i >= 0; i--) { const s = 0.2 + 0.72 * (i / N); ctx.lineTo(x(s), baixo(s) * 0.85 + onda(s)); }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // corpo
    ctx.fillStyle = gradiente(ctx, cor, h, 0.5);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const s = i / N; i ? ctx.lineTo(x(s), cima(s) + onda(s)) : ctx.moveTo(x(s), cima(s)); }
    for (let i = N; i >= 0; i--) { const s = i / N; ctx.lineTo(x(s), baixo(s) + onda(s)); }
    ctx.closePath(); ctx.fill();
    // faixas oblíquas escuras
    ctx.save(); ctx.clip();
    ctx.strokeStyle = det; ctx.globalAlpha = 0.28; ctx.lineWidth = L * 0.022;
    for (let i = 0; i < 9; i++) {
      const s = 0.22 + i * 0.075;
      ctx.beginPath(); ctx.moveTo(x(s) + L * 0.03, -h); ctx.lineTo(x(s) - L * 0.03, h); ctx.stroke();
    }
    ctx.restore();
    // nadadeira peitoral pequena
    ctx.fillStyle = det; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.ellipse(L * 0.33, h * 0.25, L * 0.04, h * 0.18, -0.5, 0, 6.3); ctx.fill();
    ctx.globalAlpha = 1;
    olho(ctx, L * 0.43, -h * 0.15, L * 0.75);
    if (temBarbilhao(v)) barbilhoes(ctx, L * 0.49, h * 0.2, L * 0.7, h, det, t);
  }

  // Desenha virado para a direita, centrado em (0,0). t = fase da natação.
  function desenhar(ctx, sp, L, t) {
    const v = sp.visual || {};
    if (v.forma === 'anguiliforme' || v.forma === 'enguia') {   // "enguia" = nome antigo
      ctx.save(); anguiliforme(ctx, v, L, t, v.cor || '#9fb8c0', v.detalhe || '#334'); ctx.restore(); return;
    }
    if (v.forma === 'tuvira') {
      ctx.save(); tuvira(ctx, v, L, t, v.cor || '#9fb8c0', v.detalhe || '#334'); ctx.restore(); return;
    }
    const f = FORMAS[v.forma] || FORMAS.fusiforme;
    const cor = v.cor || '#9fb8c0';
    const det = v.detalhe || '#334';
    const h = L * f.h;
    const balanco = Math.sin(t * 8) * 0.18;

    ctx.save();
    // cauda
    ctx.save();
    ctx.translate(-L * 0.38, 0);
    ctx.rotate(balanco);
    ctx.fillStyle = cor;
    ctx.beginPath();
    if (f.cauda === 'garfo') {
      ctx.moveTo(0, 0); ctx.lineTo(-L * 0.2, -h * 1.1); ctx.lineTo(-L * 0.12, 0); ctx.lineTo(-L * 0.2, h * 1.1);
    } else if (f.cauda === 'redonda') {
      ctx.moveTo(0, -h * 0.4); ctx.quadraticCurveTo(-L * 0.24, -h * 1.1, -L * 0.2, 0); ctx.quadraticCurveTo(-L * 0.24, h * 1.1, 0, h * 0.4);
    } else {
      ctx.moveTo(0, -h * 0.3); ctx.lineTo(-L * 0.16, -h * 0.9); ctx.lineTo(-L * 0.16, h * 0.9); ctx.lineTo(0, h * 0.3);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // nadadeira dorsal
    ctx.fillStyle = det;
    ctx.beginPath();
    if (f.dorsal === 'vela') {
      ctx.moveTo(L * 0.18, -h * 0.85); ctx.quadraticCurveTo(L * 0.05, -h * 2.2, -L * 0.15, -h * 0.9);
    } else if (f.dorsal === 'longa') {
      ctx.moveTo(L * 0.2, -h * 0.9); ctx.quadraticCurveTo(0, -h * 1.45, -L * 0.3, -h * 0.5);
    } else if (f.dorsal === 'dupla') {
      ctx.moveTo(L * 0.12, -h * 0.9); ctx.quadraticCurveTo(L * 0.05, -h * 1.8, -L * 0.02, -h * 0.95);
      ctx.moveTo(-L * 0.08, -h * 0.9); ctx.quadraticCurveTo(-L * 0.15, -h * 1.7, -L * 0.25, -h * 0.7);
    } else if (f.dorsal === 'pequena') {
      ctx.moveTo(L * 0.08, -h * 0.92); ctx.quadraticCurveTo(-L * 0.02, -h * 1.7, -L * 0.1, -h * 0.85);
    }
    ctx.closePath(); ctx.fill();

    // corpo
    const ondula = 0;
    ctx.fillStyle = gradiente(ctx, cor, h, f.barriga ? 0.7 : 0.55);
    ctx.beginPath();
    ctx.moveTo(L * 0.5, f.barriga ? h * 0.3 : 0);
    ctx.bezierCurveTo(L * 0.42, -h * 1.05, -L * 0.15, -h * 1.05 + ondula, -L * 0.4, -h * 0.25);
    ctx.lineTo(-L * 0.4, h * 0.25);
    if (f.barriga) ctx.bezierCurveTo(-L * 0.15, h * 0.9 + ondula, L * 0.3, h * 0.95, L * 0.5, h * 0.3);
    else ctx.bezierCurveTo(-L * 0.15, h * 1.05 + ondula, L * 0.42, h * 1.05, L * 0.5, 0);
    ctx.closePath(); ctx.fill();

    // detalhes
    ctx.strokeStyle = det; ctx.fillStyle = det; ctx.lineWidth = Math.max(1, L * 0.012);
    if (f.placas) {
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(L * (0.2 - i * 0.12), 0, h * 0.9, -0.9, 0.9);
        ctx.globalAlpha = 0.4; ctx.stroke(); ctx.globalAlpha = 1;
      }
    } else if (v.forma === 'alto') {
      for (let i = 0; i < 6; i++) {
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(L * (0.18 - i * 0.08), (i % 2 ? -1 : 1) * h * 0.25, L * 0.018, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(L * 0.3, 0); ctx.lineTo(-L * 0.36, 0); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    olho(ctx, L * 0.36, f.barriga ? -h * 0.1 : -h * 0.22, L);
    if (temBarbilhao(v)) barbilhoes(ctx, L * 0.47, h * 0.15, L, h, det, t);
    ctx.restore();
  }

  return { desenhar, FORMAS: [...Object.keys(FORMAS).slice(0, 5), 'anguiliforme', 'tuvira', 'gobio'], temBarbilhao };
})();
