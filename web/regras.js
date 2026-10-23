/*
 * regras.js — Lógica de pontuação de "Monte a comunidade de peixes".
 *
 * Fica separado da interface (index.html) para facilitar a edição.
 * Para mudar o jogo, comece pelo bloco CONFIG e pelas tabelas GUILDAS e RECURSOS.
 *
 * A página usa:
 *   Regras.avaliar(comunidade, ctx)       -> { saude, componentes, dicas, teia }
 *   Regras.teiaAlimentar(comunidade, ctx) -> { nos, arestas }
 *   Regras.adaptacao(especie, ctx)        -> { ok, motivo }
 *   Regras.mensagemEntrada(especie, antes, depois, ctx) -> texto curto ao entrar um peixe
 *
 * "comunidade" é a lista de espécies (objetos de especies.json) já colocadas no rio.
 * "ctx" é opcional: { ambiente, evento } do modo Desafio (ver ambientes.js).
 * O evento só entra no ctx enquanto estiver ativo (a equipe ainda não reagiu).
 * Sem ctx, vale o jogo livre (rio genérico com corrente, remanso e lago).
 */
(function (global) {
  'use strict';

  // ------------------------------------------------------------------
  // CONFIGURAÇÃO — mexa aqui
  // ------------------------------------------------------------------
  const CONFIG = {
    maxPeixesPorRodada: 5,       // a rodada termina quando o rio tiver este número de peixes
    metaSaude: 70,               // meta cooperativa (0–100)
    riquezaIdeal: 5,             // abaixo disso a saúde é reduzida (comunidade pequena demais)
    // Nota relativa: 100 = o melhor rio possível com as espécies e o ambiente da rodada.
    // Assim sempre existe uma combinação que faz 100. Com false, vale a nota absoluta.
    notaRelativa: true,
    permitirEspecieRepetida: false,

    // Peso de cada componente na saúde (a soma não precisa dar 100; é normalizada)
    pesos: {
      equilibrio:  35,  // mistura de guildas + pirâmide predador/presa
      habitats:    20,  // ocupação de corrente / remanso / lago
      nativas:     25,  // proporção de peixes nativos
      conservacao: 20   // endêmicos, ameaçados e migradores
    },
    // Pesos no modo Desafio do ambiente (entra a adaptação ao ambiente sorteado)
    pesosDesafio: {
      equilibrio:  30,
      habitats:    10,
      nativas:     20,
      conservacao: 10,
      adaptacao:   30   // peixes que vivem bem no ambiente (e aguentam o evento)
    },

    // Equilíbrio trófico
    guildasParaNotaMaxima: 4,     // número de guildas diferentes que já dá nota máxima
    presasPorPredador: 2,         // cada piscívoro precisa de pelo menos N presas no rio
    fracaoMaxPredadores: 0.34,    // acima disso: predador demais para poucas presas
    notaSemPredador: 0.5,         // sem predador de topo a cadeia fica incompleta

    // Teia desequilibrada: pontos tirados direto da saúde final (além da nota do componente)
    penalidadeSemPredador: 15,         // nenhum predador com 3 peixes ou mais
    penalidadeExcessoPredadores: 20,   // fração de predadores acima de fracaoMaxPredadores
    penalidadePredadorFaminto: 15,     // por predador sem nenhuma presa menor que ele
    penalidadePoucasPresas: 8,         // predadores com menos presas que presasPorPredador

    // Exóticas
    penalidadePorExotica: 25,     // pontos tirados da saúde final por espécie exótica

    // Conservação: "pontos" que somam até 1 (nota máxima)
    pontosEndemico: 0.4,
    pontosAmeacado: 0.5,
    pontosMigrador: 0.4,
    categoriasAmeacadas: ['VU', 'EN', 'CR']
  };

  // Guildas tróficas: nível na teia (0 = recursos) e a dieta padrão.
  // A dieta de uma espécie pode ser trocada pelo campo "come" em especies.json.
  const GUILDAS = {
    piscivoro:   { rotulo: 'Piscívoro',   descricao: 'come outros peixes',        nivel: 3, come: ['peixes'], predador: true },
    onivoro:     { rotulo: 'Onívoro',     descricao: 'come de tudo um pouco',      nivel: 2, come: ['insetos', 'frutos', 'algas'] },
    insetivoro:  { rotulo: 'Insetívoro',  descricao: 'come insetos',               nivel: 2, come: ['insetos'] },
    detritivoro: { rotulo: 'Detritívoro', descricao: 'come lodo e restos do fundo', nivel: 1, come: ['detritos', 'algas'] },
    herbivoro:   { rotulo: 'Herbívoro',   descricao: 'come algas e plantas',       nivel: 1, come: ['algas', 'frutos'] }
  };

  // Recursos da base da teia (não são peixes)
  const RECURSOS = {
    algas:    { rotulo: 'Algas',          texto: 'algas',          cor: '#4caf50' },
    detritos: { rotulo: 'Lodo e restos',  texto: 'lodo',           cor: '#8d6e63' },
    insetos:  { rotulo: 'Insetos',        texto: 'insetos',        cor: '#ffb300' },
    frutos:   { rotulo: 'Frutos da mata', texto: 'frutos da mata', cor: '#e57373' }
  };

  const HABITATS = {
    corrente: 'Corrente',
    remanso:  'Remanso',
    lago:     'Lago'
  };

  const PORTE = { pequeno: 1, medio: 2, grande: 3 };

  // ------------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------------
  const limitar = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const unicos = (lista) => [...new Set(lista)];
  const habitatsDe = (e) => (Array.isArray(e.habitat) ? e.habitat : [e.habitat]).filter(Boolean);
  const dietaDe = (e) => e.come || (GUILDAS[e.guilda_trofica] || {}).come || [];
  const ehPredador = (e) => !!(GUILDAS[e.guilda_trofica] || {}).predador;
  const ehAmeacado = (e) => CONFIG.categoriasAmeacadas.includes(String(e.status_ameaca || '').toUpperCase());
  const idDe = (e) => e.nome_cientifico || e.nome_popular;
  // base da cadeia: quem limpa o fundo (detritívoro/herbívoro ou quem come lodo)
  const ehBase = (e) => e.nativo && ((GUILDAS[e.guilda_trofica] || {}).nivel === 1 || dietaDe(e).includes('detritos'));

  // ------------------------------------------------------------------
  // Teia alimentar: quem come quem
  // ------------------------------------------------------------------
  function recursosDisponiveis(ctx) {
    let r = ctx && ctx.ambiente ? ctx.ambiente.recursos : Object.keys(RECURSOS);
    const tirar = (ctx && ctx.evento && ctx.evento.removeRecursos) || [];   // ex.: esgoto acaba com os insetos
    return r.filter((x) => !tirar.includes(x));
  }

  function teiaAlimentar(comunidade, ctx) {
    const disponiveis = recursosDisponiveis(ctx);
    const nos = [];
    const arestas = [];
    const recursosUsados = new Set();

    comunidade.forEach((e) => {
      nos.push({ id: idDe(e), tipo: 'peixe', especie: e, nivel: (GUILDAS[e.guilda_trofica] || { nivel: 2 }).nivel });
    });

    comunidade.forEach((consumidor) => {
      dietaDe(consumidor).forEach((item) => {
        if (item === 'peixes') {
          // come peixes de porte menor que o dele
          comunidade.forEach((presa) => {
            if (presa === consumidor) return;
            if ((PORTE[presa.porte] || 2) < (PORTE[consumidor.porte] || 2)) {
              arestas.push({ de: idDe(presa), para: idDe(consumidor), tipo: 'peixe' });
            }
          });
        } else if (RECURSOS[item] && disponiveis.includes(item)) {
          recursosUsados.add(item);
          arestas.push({ de: 'rec:' + item, para: idDe(consumidor), tipo: 'recurso' });
        }
      });
    });

    recursosUsados.forEach((r) => {
      nos.push({ id: 'rec:' + r, tipo: 'recurso', rotulo: RECURSOS[r].rotulo, cor: RECURSOS[r].cor, nivel: 0 });
    });

    return { nos, arestas };
  }

  // ------------------------------------------------------------------
  // Componentes da saúde (cada um retorna nota 0..1 e dicas)
  // ------------------------------------------------------------------

  // 1. Equilíbrio trófico: mistura de guildas + predador demais para poucas presas
  function equilibrioTrofico(comunidade, teia) {
    const dicas = [];
    const guildas = unicos(comunidade.map((e) => e.guilda_trofica));
    const notaGuildas = limitar(guildas.length / CONFIG.guildasParaNotaMaxima);

    const predadores = comunidade.filter(ehPredador);
    let notaPiramide;
    let penalidade = 0;
    if (predadores.length === 0) {
      notaPiramide = CONFIG.notaSemPredador;
      if (comunidade.length >= 3) {
        penalidade += CONFIG.penalidadeSemPredador;
        dicas.push({ prioridade: 3, texto: 'Falta um predador de topo! Sem ele, os peixes pequenos se multiplicam demais.' });
      }
    } else {
      // presas = peixes que algum predador come
      const idsPredadores = new Set(predadores.map(idDe));
      const presas = new Set(teia.arestas.filter((a) => idsPredadores.has(a.para) && !a.de.startsWith('rec:')).map((a) => a.de));
      const notaPresas = limitar(presas.size / (predadores.length * CONFIG.presasPorPredador));
      const fracao = predadores.length / comunidade.length;
      const notaFracao = fracao <= CONFIG.fracaoMaxPredadores
        ? 1
        : limitar(1 - (fracao - CONFIG.fracaoMaxPredadores) / (1 - CONFIG.fracaoMaxPredadores));
      notaPiramide = Math.min(notaPresas, notaFracao);

      predadores.forEach((p) => {
        const temPresa = teia.arestas.some((a) => a.para === idDe(p) && !a.de.startsWith('rec:'));
        if (!temPresa) {
          penalidade += CONFIG.penalidadePredadorFaminto;
          dicas.push({ prioridade: 4, texto: `${p.nome_popular} está com fome! Precisa de peixes menores para comer.` });
        }
      });
      if (notaFracao < 1) {
        penalidade += CONFIG.penalidadeExcessoPredadores;
        dicas.push({ prioridade: 4, texto: 'Predadores demais para poucas presas! Coloque mais peixes pequenos.' });
      } else if (notaPresas < 1) {
        penalidade += CONFIG.penalidadePoucasPresas;
        dicas.push({ prioridade: 2, texto: 'Os predadores precisam de mais presas. Coloque lambaris ou piabas!' });
      }
    }

    const temBase = comunidade.some(ehBase);
    const notaBase = temBase ? 1 : 0;
    if (!temBase && comunidade.length >= 2) dicas.push({ prioridade: 2, texto: 'Ninguém limpa o fundo do rio. Um cascudo comeria o lodo e as algas.' });
    if (guildas.length < 3 && comunidade.length >= 3) dicas.push({ prioridade: 1, texto: 'Os peixes comem quase as mesmas coisas. Misture dietas diferentes!' });

    return { nota: 0.4 * notaGuildas + 0.4 * notaPiramide + 0.2 * notaBase, dicas, penalidade };
  }

  // 2. Habitats: o rio tem corrente, remanso e lago; cada um precisa de moradores nativos
  function ocupacaoHabitats(comunidade, teia, ctx) {
    const dicas = [];
    const existentes = ctx && ctx.ambiente ? ctx.ambiente.habitats : Object.keys(HABITATS);
    const ocupados = unicos(comunidade.filter((e) => e.nativo).flatMap(habitatsDe)).filter((h) => existentes.includes(h));
    existentes.forEach((h) => {
      if (!ocupados.includes(h) && comunidade.length >= 2) {
        dicas.push({ prioridade: 1, texto: `Nenhum peixe nativo vive no ${HABITATS[h].toLowerCase()} ainda.` });
      }
    });
    return { nota: ocupados.length / existentes.length, dicas };
  }

  // 3. Nativas: proporção de peixes nativos
  function proporcaoNativas(comunidade) {
    const dicas = [];
    const exoticas = comunidade.filter((e) => !e.nativo);
    exoticas.forEach((e) => dicas.push({ prioridade: 4, texto: `${e.nome_popular} é exótica: disputa comida e espaço com os peixes nativos.` }));
    return { nota: 1 - exoticas.length / comunidade.length, dicas };
  }

  // 4. Conservação: endêmicos, ameaçados e migradores valem pontos extras
  function conservacao(comunidade, teia, ctx) {
    const dicas = [];
    const nativos = comunidade.filter((e) => e.nativo && adaptacao(e, ctx).ok);
    const pontos =
      nativos.filter((e) => e.endemico).length * CONFIG.pontosEndemico +
      nativos.filter(ehAmeacado).length * CONFIG.pontosAmeacado +
      nativos.filter((e) => e.migrador).length * CONFIG.pontosMigrador;
    if (!nativos.some((e) => e.migrador) && comunidade.length >= 3 && !(ctx && ctx.ambiente && ctx.ambiente.bloqueiaMigradores)) {
      dicas.push({ prioridade: 1, texto: 'Nenhum peixe migrador. Eles só vivem em rios sem barreiras, do mar até a serra.' });
    }
    if (!nativos.some((e) => e.endemico || ehAmeacado(e)) && comunidade.length >= 4) {
      dicas.push({ prioridade: 1, texto: 'Tem algum peixe raro, que só existe aqui? Ele vale pontos extras!' });
    }
    return { nota: limitar(pontos), dicas };
  }

  // 5. Adaptação (só no Desafio): o peixe vive bem neste ambiente, aguenta o evento e tem comida
  function adaptacao(e, ctx) {
    if (!ctx || !ctx.ambiente) return { ok: true, motivo: null };
    const amb = ctx.ambiente;
    if (amb.bloqueiaMigradores && e.migrador) {
      return { ok: false, tipo: 'barragem', motivo: `${e.nome_popular}: a barragem bloqueia o caminho até o mar.` };
    }
    if (!(e.ambientes || []).includes(amb.id)) {
      return { ok: false, tipo: 'ambiente', motivo: `${e.nome_popular} não vive bem ${amb.onde}.` };
    }
    if (ctx.evento && (e.sofre_com || []).includes(ctx.evento.id)) {
      return { ok: false, tipo: 'evento', motivo: (ctx.evento.motivo || '{nome} sofre com o evento.').replace('{nome}', e.nome_popular) };
    }
    return { ok: true, motivo: null };
  }

  function adaptacaoAoAmbiente(comunidade, teia, ctx) {
    const dicas = [];
    let adaptados = 0;
    comunidade.forEach((e) => {
      const a = adaptacao(e, ctx);
      const temComida = teia.arestas.some((x) => x.para === idDe(e));
      if (!a.ok) dicas.push({ prioridade: 3, texto: a.motivo });
      else if (!temComida) dicas.push({ prioridade: 3, texto: `${e.nome_popular} não tem o que comer aqui!` });
      else adaptados++;
    });
    return { nota: adaptados / comunidade.length, dicas };
  }

  const COMPONENTES = [
    { id: 'equilibrio',  rotulo: 'Equilíbrio da cadeia alimentar', calcular: equilibrioTrofico },
    { id: 'habitats',    rotulo: 'Habitats ocupados',               calcular: ocupacaoHabitats },
    { id: 'nativas',     rotulo: 'Peixes nativos',                  calcular: proporcaoNativas },
    { id: 'conservacao', rotulo: 'Espécies especiais',              calcular: conservacao },
    { id: 'adaptacao',   rotulo: 'Adaptação ao ambiente',           calcular: adaptacaoAoAmbiente }
  ];

  // ------------------------------------------------------------------
  // Avaliação geral
  // ------------------------------------------------------------------
  function avaliar(comunidade, ctx) {
    const teia = teiaAlimentar(comunidade, ctx);
    const pesos = ctx && ctx.ambiente ? CONFIG.pesosDesafio : CONFIG.pesos;
    const ativos = COMPONENTES.filter((c) => pesos[c.id]);
    if (comunidade.length === 0) {
      return {
        saude: 0,
        bruta: 0,
        componentes: ativos.map((c) => ({ id: c.id, rotulo: c.rotulo, nota: 0, peso: pesos[c.id] })),
        dicas: ['Encoste o primeiro peixe no leitor para começar!'],
        teia
      };
    }

    // No Desafio, peixe que não vive bem no ambiente não sobrevive: aparece no rio,
    // mas só os sobreviventes contam para a cadeia alimentar, habitats etc.
    const sobreviventes = ctx && ctx.ambiente ? comunidade.filter((e) => adaptacao(e, ctx).ok) : comunidade;
    const teiaSobreviventes = sobreviventes === comunidade ? teia : teiaAlimentar(sobreviventes, ctx);

    let soma = 0;
    let somaPesos = 0;
    let penalidades = 0;   // pontos tirados direto (teia desequilibrada)
    let dicas = [];
    const componentes = ativos.map((c) => {
      let r;
      // adaptação olha todos os peixes, mas a comida só existe entre os sobreviventes
      if (c.id === 'adaptacao') r = c.calcular(comunidade, teiaSobreviventes, ctx);
      else if (sobreviventes.length) r = c.calcular(sobreviventes, teiaSobreviventes, ctx);
      else r = { nota: 0, dicas: [] };
      const peso = pesos[c.id];
      soma += r.nota * peso;
      somaPesos += peso;
      penalidades += r.penalidade || 0;
      dicas = dicas.concat(r.dicas);
      return { id: c.id, rotulo: c.rotulo, nota: limitar(r.nota), peso };
    });

    const ideal = riquezaIdeal(ctx);
    const fatorRiqueza = 0.3 + 0.7 * limitar(sobreviventes.length / ideal);
    if (comunidade.length < ideal) {
      dicas.push({ prioridade: 0, texto: 'A comunidade ainda está pequena. Continue colocando peixes!' });
    } else if (sobreviventes.length < comunidade.length) {
      dicas.push({ prioridade: 0, texto: `Só ${sobreviventes.length} dos ${comunidade.length} peixes conseguem viver aqui.` });
    }

    const exoticas = comunidade.filter((e) => !e.nativo).length;
    let bruta = (soma / (somaPesos || 1)) * 100 * fatorRiqueza - exoticas * CONFIG.penalidadePorExotica - penalidades;
    // nota relativa: divide pelo melhor resultado possível nesta rodada (ctx.maximo, calculado por melhores())
    if (CONFIG.notaRelativa && ctx && ctx.maximo > 0) bruta = (bruta / ctx.maximo) * 100;
    bruta = Math.round(bruta);
    const saude = limitar(bruta, 0, 100);   // "bruta" pode ficar negativa: o relatório usa para mostrar o efeito de cada jogada

    dicas.sort((a, b) => b.prioridade - a.prioridade);
    return { saude, bruta, componentes, dicas: unicos(dicas.map((d) => d.texto)), teia };
  }

  // Mensagem curta mostrada quando um peixe entra
  function mensagemEntrada(especie, saudeAntes, saudeDepois, ctx) {
    const d = saudeDepois - saudeAntes;
    if (!especie.nativo && especie.tentador) {
      const motivo = especie.por_que_tenta ? ` (${especie.por_que_tenta})` : '';
      return `Parecia uma boa ideia${motivo}… mas prejudica os peixes nativos!`;
    }
    if (!especie.nativo) return 'Peixe exótico! A comunidade nativa sofre.';
    const a = adaptacao(especie, ctx);
    if (!a.ok) return a.motivo;
    if (d >= 10) return 'Ótima escolha! O rio ficou muito mais saudável.';
    if (d > 0) return 'Boa! A comunidade melhorou.';
    if (d === 0) return 'A saúde do rio não mudou. Pense no que está faltando.';
    return 'Hmm… a comunidade perdeu equilíbrio.';
  }

  // ------------------------------------------------------------------
  // Relatório: explica por que a comunidade ficou boa ou ruim
  // ------------------------------------------------------------------
  const juntar = (nomes) => (nomes.length <= 1 ? nomes.join('') : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]);

  function explicar(comunidade, ctx) {
    const positivos = [];   // { icone, texto }
    const negativos = [];   // { icone, texto, pontos? }
    const amb = ctx && ctx.ambiente;
    const sobreviventes = amb ? comunidade.filter((e) => adaptacao(e, ctx).ok) : comunidade;
    const teia = teiaAlimentar(sobreviventes, ctx);
    const nomeDe = (id) => {
      const e = comunidade.find((x) => idDe(x) === id);
      return e ? e.nome_popular : (RECURSOS[id.replace('rec:', '')] || {}).texto || id;
    };
    const n = sobreviventes.length;

    const predadoresVivos = sobreviventes.filter(ehPredador);
    const excesso = predadoresVivos.length > 1 && predadoresVivos.length / n > CONFIG.fracaoMaxPredadores;

    // --- cada peixe
    const peixes = comunidade.map((e) => {
      const bons = [], ruins = [];
      const a = adaptacao(e, ctx);
      const id = idDe(e);
      if (!e.nativo) {
        ruins.push(`Exótico: disputa comida e espaço com os nativos (−${CONFIG.penalidadePorExotica}).` +
          (e.por_que_tenta ? ` Parecia boa ideia porque ${e.por_que_tenta}.` : ''));
      }
      if (!a.ok) {
        ruins.push(`${a.motivo.replace(e.nome_popular + ': ', '').replace(e.nome_popular + ' ', '')} Por isso não contou na comunidade.`.replace(/^./, (c) => c.toUpperCase()));
      } else {
        const presas = teia.arestas.filter((x) => x.para === id && x.tipo === 'peixe').map((x) => nomeDe(x.de));
        const predadores = teia.arestas.filter((x) => x.de === id && x.tipo === 'peixe').map((x) => nomeDe(x.para));
        const comida = teia.arestas.filter((x) => x.para === id);
        if (ehPredador(e)) {
          if (presas.length) (e.nativo ? bons : ruins).push(`${e.nativo ? 'Predador de topo' : 'Predador invasor'}: come ${juntar(presas)}.`);
          else ruins.push(`Predador sem nenhuma presa menor que ele: passou fome (−${CONFIG.penalidadePredadorFaminto}).`);
          if (excesso) {
            const outros = predadoresVivos.filter((p) => p !== e).map((p) => p.nome_popular);
            ruins.push(`Junto com ${juntar(outros)}, são predadores demais para as presas.`);
          }
        } else if (!comida.length) {
          ruins.push('Não encontrou nada para comer aqui.');
        } else if (e.nativo) {
          bons.push(`Come ${juntar(comida.map((x) => nomeDe(x.de)))}.`);
        }
        if (ehBase(e)) bons.push('Base da cadeia: ajuda a limpar o fundo comendo lodo.');
        if (predadores.length) (e.nativo ? bons : ruins).push(`Serve de alimento para ${juntar(predadores)}.`);
        if (e.nativo && e.endemico) bons.push('Endêmico: só existe nesta região (bônus).');
        if (e.nativo && ehAmeacado(e)) bons.push('Ameaçado de extinção: protegê-lo vale bônus.');
        if (e.nativo && e.migrador && !(amb && amb.bloqueiaMigradores)) bons.push('Migrador: só aparece em rio conectado do mar até a serra (bônus).');
      }
      const efeito = ruins.length && bons.length ? 'misto' : ruins.length ? 'ruim' : 'bom';
      return { sp: e, papel: (GUILDAS[e.guilda_trofica] || {}).rotulo || '', efeito, bons, ruins };
    });

    // --- cadeia alimentar
    const predadores = sobreviventes.filter(ehPredador);
    const famintos = predadores.filter((p) => !teia.arestas.some((x) => x.para === idDe(p) && x.tipo === 'peixe'));
    if (n >= 3 && !predadores.length) {
      negativos.push({ icone: '🦈', texto: 'Nenhum predador de topo: sem ele, os peixes pequenos se multiplicam demais e acabam com a comida.', pontos: CONFIG.penalidadeSemPredador });
    } else if (predadores.length && predadores.length / n > CONFIG.fracaoMaxPredadores) {
      negativos.push({ icone: '🦈', texto: `Predadores demais (${juntar(predadores.map((p) => p.nome_popular))}) para poucas presas: a cadeia desequilibra.`, pontos: CONFIG.penalidadeExcessoPredadores });
    } else if (predadores.length && !famintos.length) {
      positivos.push({ icone: '🦈', texto: `Cadeia com predador de topo (${juntar(predadores.map((p) => p.nome_popular))}) controlando as presas.` });
    }
    if (famintos.length) {
      negativos.push({ icone: '🍽️', texto: `${juntar(famintos.map((p) => p.nome_popular))} ficou sem presa menor para comer.`, pontos: famintos.length * CONFIG.penalidadePredadorFaminto });
    }
    const guildas = unicos(sobreviventes.map((e) => e.guilda_trofica));
    if (guildas.length >= CONFIG.guildasParaNotaMaxima) positivos.push({ icone: '🍃', texto: `Dietas variadas: ${guildas.length} jeitos diferentes de se alimentar, ninguém disputa a mesma comida.` });
    else if (n >= 3 && guildas.length < 3) negativos.push({ icone: '🍃', texto: 'Quase todos comem as mesmas coisas: falta variedade de dietas.' });
    const base = sobreviventes.filter(ehBase);
    if (base.length) positivos.push({ icone: '🪨', texto: `${juntar(base.map((e) => e.nome_popular))} ${base.length > 1 ? 'fazem' : 'faz'} a base da cadeia, limpando o fundo.` });
    else if (n >= 2) negativos.push({ icone: '🪨', texto: 'Ninguém na base da cadeia para comer o lodo do fundo.' });

    // --- nativos e exóticos
    const exoticos = comunidade.filter((e) => !e.nativo);
    if (exoticos.length) {
      negativos.push({ icone: '⚠️', texto: `${juntar(exoticos.map((e) => e.nome_popular))}: ${exoticos.length > 1 ? 'são exóticos e disputam' : 'é exótico e disputa'} comida e espaço com os nativos.`, pontos: exoticos.length * CONFIG.penalidadePorExotica });
    } else if (comunidade.length) {
      positivos.push({ icone: '🇧🇷', texto: 'Só peixes nativos: nenhum invasor no rio.' });
    }

    // --- ambiente e evento
    if (amb) {
      const fora = comunidade.filter((e) => adaptacao(e, ctx).tipo === 'ambiente');
      const barrados = comunidade.filter((e) => adaptacao(e, ctx).tipo === 'barragem');
      if (fora.length) negativos.push({ icone: amb.icone, texto: `${juntar(fora.map((e) => e.nome_popular))} não ${fora.length > 1 ? 'vivem' : 'vive'} bem ${amb.onde}.` });
      if (barrados.length) negativos.push({ icone: '🧱', texto: `${juntar(barrados.map((e) => e.nome_popular))}: a barragem bloqueia o caminho até o mar, e migrador sem caminho não se reproduz.` });
      if (!fora.length && !barrados.length && comunidade.length) positivos.push({ icone: amb.icone, texto: `Todos os peixes escolhidos vivem bem ${amb.onde}.` });
      if (ctx.evento) {
        const afetados = comunidade.filter((e) => adaptacao(e, ctx).tipo === 'evento');
        const semComida = (ctx.evento.removeRecursos || []).map((r) => (RECURSOS[r] || {}).texto).filter(Boolean);
        const partes = [];
        if (afetados.length) partes.push(`${juntar(afetados.map((e) => e.nome_popular))} ${afetados.length > 1 ? 'sofreram e não contaram' : 'sofreu e não contou'}`);
        if (semComida.length) partes.push(`${juntar(semComida)} sumiram da teia`);
        negativos.push({ icone: ctx.evento.icone, texto: `${ctx.evento.nome.replace(/!$/, '')} e ninguém reagiu: ${partes.length ? juntar(partes) : 'o rio piorou'}.` });
      }
    }

    // --- habitats, conservação, tamanho
    const existentes = amb ? amb.habitats : Object.keys(HABITATS);
    const ocupados = unicos(sobreviventes.filter((e) => e.nativo).flatMap(habitatsDe)).filter((h) => existentes.includes(h));
    const faltam = existentes.filter((h) => !ocupados.includes(h));
    if (!faltam.length && n) positivos.push({ icone: '🌊', texto: `Todos os habitats ocupados (${juntar(existentes.map((h) => HABITATS[h].toLowerCase()))}).` });
    else if (n >= 2) negativos.push({ icone: '🌊', texto: `Nenhum peixe nativo ocupou ${juntar(faltam.map((h) => 'o ' + HABITATS[h].toLowerCase()))}.` });
    const especiais = sobreviventes.filter((e) => e.nativo && (e.endemico || ehAmeacado(e) || (e.migrador && !(amb && amb.bloqueiaMigradores))));
    if (especiais.length) positivos.push({ icone: '⭐', texto: `${juntar(especiais.map((e) => e.nome_popular))}: ${especiais.length > 1 ? 'espécies especiais' : 'espécie especial'} (rara, ameaçada ou migradora), vale bônus.` });
    if (n < riquezaIdeal(ctx) && comunidade.length) {
      negativos.push({ icone: '🐟', texto: n < comunidade.length ? `Só ${n} dos ${comunidade.length} peixes conseguiram viver aqui: a comunidade ficou pequena.` : 'Comunidade pequena: poucos peixes no rio.' });
    }

    return { positivos, negativos, peixes };
  }

  // ------------------------------------------------------------------
  // Melhor combinação possível (testa todas: 5 de 14 espécies = 2002 combinações)
  // ------------------------------------------------------------------
  function combinacoes(lista, k, fazer) {
    const idx = [];
    (function rec(inicio, nivel) {
      if (nivel === k) { fazer(idx.map((i) => lista[i])); return; }
      for (let i = inicio; i <= lista.length - (k - nivel); i++) { idx[nivel] = i; rec(i + 1, nivel + 1); }
    })(0, 0);
  }

  // Retorna as `quantos` melhores combinações de n espécies, a nota absoluta de cada uma
  // e quantas combinações existem no total. ctx: { ambiente, evento, vagas } (sem "maximo").
  function melhores(especies, ctx, n, quantos = 3) {
    const semMax = { ...(ctx || {}), maximo: undefined };
    const k = Math.min(n, especies.length);
    const top = [];
    let total = 0;
    const notas = [];
    combinacoes(especies, k, (c) => {
      const r = avaliar(c, semMax);
      total++;
      notas.push(r.bruta);
      if (top.length < quantos || r.bruta > top[top.length - 1].nota) {
        top.push({ nota: r.bruta, especies: c });
        top.sort((a, b) => b.nota - a.nota);
        if (top.length > quantos) top.pop();
      }
    });
    return { top, total, notas };
  }

  // riqueza ideal nunca passa do número de peixes que cabem na rodada (ex.: reagir a um evento deixa 4 vagas)
  function riquezaIdeal(ctx) {
    return Math.max(1, Math.min(CONFIG.riquezaIdeal, (ctx && ctx.vagas) || CONFIG.riquezaIdeal));
  }

  // aplica um config.json por cima dos valores padrão (usado pelo jogo e pelo painel admin)
  function aplicarConfig(cfg) {
    if (!cfg || !cfg.regras) return;
    Object.entries(cfg.regras).forEach(([k, v]) => {
      if (v && typeof v === 'object' && !Array.isArray(v) && CONFIG[k] && typeof CONFIG[k] === 'object') Object.assign(CONFIG[k], v);
      else if (k in CONFIG) CONFIG[k] = v;
    });
  }

  global.Regras = { CONFIG, GUILDAS, RECURSOS, HABITATS, PORTE, avaliar, teiaAlimentar, adaptacao, explicar, mensagemEntrada, ehAmeacado, idDe, melhores, aplicarConfig };
})(typeof window !== 'undefined' ? window : globalThis);
