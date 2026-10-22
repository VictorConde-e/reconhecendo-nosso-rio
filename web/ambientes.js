/*
 * ambientes.js — Ambientes do modo "Desafio do ambiente" e eventos sorteados
 *   (desmatamento, esgoto, seca e soltura de peixe exótico).
 *
 * Fica separado da interface, como regras.js, para facilitar a edição.
 *   habitats: quais habitats existem ali (corrente | remanso | lago)
 *   recursos: alimentos disponíveis na teia (algas | detritos | insetos | frutos)
 *   nomeCurto: aparece no cabeçalho durante o jogo
 *   onde:     usado nas frases ("não vive bem na represa")
 *   bloqueiaMigradores: migradores não completam o ciclo (barragem)
 *   meta:     meta de saúde própria (opcional; senão vale Regras.CONFIG.metaSaude)
 *   visual:   só aparência do cenário
 *
 * Quais espécies vivem bem em cada ambiente fica em especies.json (campo "ambientes").
 */
(function (global) {
  'use strict';

  const lista = [
    {
      id: 'cabeceira',
      nome: 'Cabeceira na serra',
      nomeCurto: 'Cabeceira',
      icone: '⛰️',
      onde: 'na cabeceira',
      descricao: 'Riacho de água fria e limpa, com corredeiras, pedras grandes e mata fechada nas margens.',
      vale: 'Peixes de corredeira, que gostam de água rápida e cheia de oxigênio.',
      habitats: ['corrente'],
      recursos: ['algas', 'insetos', 'frutos', 'detritos'],
      visual: {
        agua: ['#3fb3bb', '#1f8f9c', '#0f5c68'], mata: '#1f5a34', corrente: 2.4,
        espuma: true, pedras: 1, pedregulho: true, plantas: 'poucas'   // muitas pedras grandes e médias
      }
    },
    {
      id: 'planicie',
      nome: 'Rio na planície',
      nomeCurto: 'Planície',
      icone: '🏞️',
      onde: 'no rio da planície',
      descricao: 'O rio desce da serra e fica mais largo e calmo, com trechos de corrente e remansos nas margens.',
      vale: 'Uma boa mistura de peixes de corrente e de remanso.',
      habitats: ['corrente', 'remanso'],
      recursos: ['algas', 'insetos', 'frutos', 'detritos'],
      visual: {}
    },
    {
      id: 'brejo',
      nome: 'Brejo com poças temporárias',
      nomeCurto: 'Brejo',
      icone: '🌾',
      onde: 'no brejo',
      descricao: 'Área alagada da baixada, com água rasa e parada, capim e taboa. Algumas poças secam na seca.',
      vale: 'Peixes de água parada, que aguentam pouco oxigênio.',
      habitats: ['remanso'],
      recursos: ['algas', 'insetos', 'detritos'],
      meta: 65,                 // só 4 nativos vivem bem aqui
      visual: {
        agua: ['#5f8250', '#41623c', '#273f28'], areia: ['#5d4a33', '#3d2f20'], mata: '#5f8a3e',
        corrente: 0.15, pedras: 0.4, plantas: 'taboa'
      }
    },
    {
      id: 'represa',
      nome: 'Represa',
      nomeCurto: 'Represa',
      icone: '🧱',
      onde: 'na represa',
      descricao: 'Uma barragem segurou o rio e formou um lago fundo de água parada. Os peixes não conseguem passar pela barragem.',
      vale: 'Peixes de lago. Os migradores ficam sem caminho, e os exóticos costumam se dar bem.',
      habitats: ['lago'],
      recursos: ['algas', 'insetos', 'detritos'],
      bloqueiaMigradores: true,
      meta: 45,                 // poucos nativos aguentam a represa: é o ambiente mais difícil
      visual: {
        agua: ['#2a78a3', '#17557f', '#0b2f4d'], mata: '#3a6b45', densidadeMata: 0.6,
        corrente: 0.1, pedras: 0.6, plantas: 'poucas', barragem: true
      }
    }
  ];

  // Eventos sorteados no meio da rodada do Desafio. Cada um tem uma reação que a equipe
  // pode escolher: ela gasta UMA das jogadas da rodada (no lugar de um peixe).
  //   afeta:          as espécies com este id em "sofre_com" (especies.json) não sobrevivem
  //   motivo:         frase para quem sofre ({nome} vira o nome do peixe)
  //   removeRecursos: alimentos que somem da teia enquanto o evento durar
  //   soltaExotica:   coloca no rio um peixe exótico que ninguém escolheu
  const eventos = [
    {
      id: 'desmatamento',
      nome: 'Desmataram a margem!',
      icone: '🪓',
      descricao: 'Sem a mata ciliar, a terra desce para o rio e a água fica turva. Acabam os frutos que caíam na água, e os peixes mais sensíveis sofrem.',
      motivo: '{nome} sofre com a água turva.',
      removeRecursos: ['frutos'],
      reacao: { botao: 'Replantar a mata', icone: '🌱', aviso: 'A equipe replantou a mata! A água vai clarear.' },
      final: { reagiu: 'Vocês replantaram a mata depois do desmatamento. A água voltou a clarear!', naoReagiu: 'A margem continuou desmatada, e os peixes sensíveis sofreram.' },
      visual: { turbidez: 0.45, corTurbidez: '150, 110, 60', semMata: true }
    },
    {
      id: 'esgoto',
      nome: 'Esgoto no rio!',
      icone: '🚽',
      descricao: 'O esgoto de um bairro caiu no rio sem tratamento. A água escurece, as algas crescem demais e falta oxigênio. Os insetos aquáticos somem, e os peixes que precisam de água limpa sofrem.',
      motivo: '{nome} sofre sem oxigênio na água suja.',
      removeRecursos: ['insetos'],
      reacao: { botao: 'Tratar o esgoto', icone: '🚰', aviso: 'O esgoto agora passa por tratamento! A água vai melhorar.' },
      final: { reagiu: 'Vocês trataram o esgoto, e o oxigênio voltou para a água.', naoReagiu: 'O esgoto continuou caindo no rio, e faltou oxigênio para os peixes.' },
      visual: { turbidez: 0.42, corTurbidez: '70, 95, 40', cano: true, espumaSuja: true }
    },
    {
      id: 'seca',
      nome: 'Seca forte!',
      icone: '☀️',
      descricao: 'Passaram meses sem chover. O rio baixou, a água esquentou e a corrente quase parou. Quem precisa de água corrente e fresca sofre. Alguns peixes aguentam: há quem até tenha ovos que esperam a chuva no barro!',
      motivo: '{nome} sofre com o rio baixo e quente.',
      removeRecursos: [],
      reacao: { botao: 'Proteger as nascentes', icone: '💧', aviso: 'A equipe protegeu as nascentes! Aos poucos a água volta.' },
      final: { reagiu: 'Vocês protegeram as nascentes, e o rio voltou a encher.', naoReagiu: 'A seca continuou, e os peixes de corredeira sofreram.' },
      visual: { nivel: 0.13, sol: true, turbidez: 0.12, corTurbidez: '160, 130, 70', corrente: 0.2 }
    },
    {
      id: 'soltura',
      nome: 'Soltaram um peixe exótico!',
      icone: '🪣',
      descricao: 'Alguém soltou no rio um peixe de criação que veio de outro lugar. Ninguém da equipe escolheu, mas ele já está nadando e disputando comida com os nativos.',
      soltaExotica: true,
      reacao: { botao: 'Retirar o peixe solto', icone: '🎣', aviso: 'A equipe retirou o peixe exótico do rio!' },
      final: { reagiu: 'Vocês tiraram do rio o peixe exótico que foi solto. Nunca solte peixes de criação ou de aquário no rio!', naoReagiu: 'O peixe exótico solto ficou no rio competindo com os nativos.' },
      visual: null
    }
  ];

  const CONFIG = {
    chanceEvento: 0.7,         // chance de acontecer um evento numa rodada do desafio
    eventoAposPeixe: [2, 3],   // sorteia depois de qual peixe o evento acontece
    atrasoEventoMs: 1200,      // tempo entre o peixe entrar e o evento aparecer (toques ficam bloqueados)
    duracaoSorteioMs: 2200
  };

  const eventoPorId = (id) => eventos.find((e) => e.id === id);

  const porId = (id) => lista.find((a) => a.id === id);

  global.Ambientes = { lista, eventos, CONFIG, porId, eventoPorId };
})(typeof window !== 'undefined' ? window : globalThis);
