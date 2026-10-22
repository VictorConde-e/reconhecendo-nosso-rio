/*
 * peixe.js — Desenho dos peixes no canvas (usado pelo jogo e pelo painel admin).
 * Formas simples a partir do campo "visual" de especies.json:
 *   forma: fusiforme | alto | alongado | achatado | bagre | enguia | gobio
 *   cor / detalhe: cores do corpo e das nadadeiras
 */
'use strict';
const Peixe = (() => {
  const FORMAS = {
    fusiforme: { h: 0.2,  cauda: 'garfo',   dorsal: 'pequena' },
    alto:      { h: 0.32, cauda: 'reta',    dorsal: 'longa' },
    alongado:  { h: 0.15, cauda: 'redonda', dorsal: 'pequena' },
    achatado:  { h: 0.17, cauda: 'garfo',   dorsal: 'vela', placas: true, barriga: true },
    bagre:     { h: 0.15, cauda: 'garfo',   dorsal: 'pequena', bigode: 3 },
    enguia:    { h: 0.08, cauda: 'redonda', dorsal: 'nenhuma', bigode: 2 },
    gobio:     { h: 0.13, cauda: 'redonda', dorsal: 'dupla', barriga: true }
  };

  function clarear(hex, q) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(c + (255 - c) * q);
    return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
  }

  // Desenha virado para a direita, centrado em (0,0). t = fase da natação.
  function desenhar(ctx, sp, L, t) {
    const v = sp.visual || {};
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
    const ondula = v.forma === 'enguia' ? Math.sin(t * 6) * h * 0.6 : 0;
    const grad = ctx.createLinearGradient(0, -h, 0, h);
    grad.addColorStop(0, cor);
    grad.addColorStop(f.barriga ? 0.7 : 0.55, cor);
    grad.addColorStop(1, clarear(cor, 0.55));
    ctx.fillStyle = grad;
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

    // olho
    const eyeX = L * 0.36, eyeY = f.barriga ? -h * 0.1 : -h * 0.22;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(eyeX, eyeY, L * 0.035, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(eyeX + L * 0.008, eyeY, L * 0.02, 0, 6.3); ctx.fill();

    // bigodes (barbilhões)
    if (f.bigode) {
      ctx.strokeStyle = det; ctx.lineWidth = Math.max(1, L * 0.01);
      for (let i = 0; i < f.bigode; i++) {
        ctx.beginPath();
        ctx.moveTo(L * 0.47, h * 0.15);
        ctx.quadraticCurveTo(L * 0.6, h * (0.3 + i * 0.3), L * (0.5 + 0.15 * (i + 1) * 0.6), h * (0.9 + i * 0.4) + Math.sin(t * 4 + i) * h * 0.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  return { desenhar };
})();
