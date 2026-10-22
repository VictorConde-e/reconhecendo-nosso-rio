# Monte a comunidade de peixes

Jogo cooperativo da extensão **Re-conhecendo nosso rio**, em Cachoeiras de Macacu (RJ), na bacia do rio Guapiaçu.

Os participantes encostam peixes impressos em 3D, com uma tag NFC dentro, num leitor. Cada peixe entra num rio animado na tela. A equipe tenta montar uma comunidade saudável: cadeia alimentar equilibrada, habitats ocupados e peixes nativos.

Não precisa de servidor, internet nem Wi-Fi. Basta o Chrome ou o Edge e um cabo USB.

```
reconhecendo-nosso-rio/
├── firmware/            ESP32 + RC522 (PlatformIO)
│   ├── platformio.ini
│   ├── src/main.cpp
│   └── LIGACAO.md       pinos, LED e dicas para embutir a tag no peixe
└── web/
    ├── index.html       interface do jogo (abrir no Chrome/Edge)
    ├── admin.html       painel admin: editar espécies, descrições e UIDs
    ├── peixe.js         desenho dos peixes (usado pelo jogo e pelo painel)
    ├── regras.js        pontuação, fácil de editar
    ├── ambientes.js     ambientes do Desafio e o evento "Desmataram a margem!"
    ├── especies.json    tabela UID -> espécie (revisar!)
    └── img/             ilustrações opcionais; img/fotos/ = fotos reais
ferramentas/
└── baixar_fotos.py      baixa as fotos reais do Wikimedia Commons
```

## Modos de jogo

A rodada tem **5 jogadas**, mostradas no cabeçalho (🐟🐟🌱◻️◻️). Cada jogada é um peixe ou uma reação a um evento.

A página abre numa tela inicial com três modos:

| Modo | Como funciona |
|---|---|
| **Monte a comunidade** | Cooperativo, 5 peixes, meta de saúde 70 |
| **Desafio do ambiente** | O jogo sorteia um ambiente: cabeceira, planície, brejo ou represa. Só contam os peixes que vivem bem nele. Em cerca de 70% das rodadas acontece um evento depois do 2º ou 3º peixe (ver abaixo) |
| **Conheça os peixes** | Sem pontos nem vez: encosta o peixe e vê a ficha e a teia |

### Eventos do Desafio

| Evento | O que acontece | Reação (usa 1 jogada) |
|---|---|---|
| 🪓 Desmataram a margem! | Água turva, os frutos da mata somem da teia | 🌱 Replantar a mata |
| 🚽 Esgoto no rio! | Água escura e sem oxigênio, os insetos aquáticos somem da teia | 🚰 Tratar o esgoto |
| ☀️ Seca forte! | O rio baixa e esquenta, a corrente quase para | 💧 Proteger as nascentes |
| 🪣 Soltaram um peixe exótico! | Um exótico entra no rio sem ninguém escolher | 🎣 Retirar o peixe solto |

Quem sofre com cada evento vem do campo `sofre_com` de `especies.json`. Enquanto o evento está chegando (1,2 s), os toques no leitor ficam bloqueados, para nenhum peixe entrar antes dele.

Com o leitor, encostar um peixe também fecha o cartão do ambiente sorteado e o do evento. Dá para jogar sem mouse.

## 1. Rodar sem hardware (modo simulação)

1. Abra `web/index.html` no Chrome ou no Edge.
2. Se o navegador pedir a tabela, escolha `web/especies.json`. Isso só acontece com a página aberta por dois cliques (`file://`), e o navegador guarda o arquivo para as próximas vezes.
3. Aperte **S** ou o botão **Simulação**. As teclas **1–9**, **0** e **-** "tocam" cada peixe e **U** simula uma tag desconhecida.

Para desenvolver, é mais prático servir a pasta. Assim cada edição do JSON aparece só recarregando a página:

```bash
cd web
python3 -m http.server 8000
# abrir http://localhost:8000          (simulação já ligada: ?simulacao)
```

### Atalhos

| Tecla | Ação |
|---|---|
| 1–9, 0, - | Toca o peixe (só no modo simulação) |
| U | UID desconhecido (simulação) |
| ⌫ | Desfaz o último peixe (simulação) |
| 1, 2, 3 | Na tela inicial, escolhe o modo |
| N | Nova rodada (no Desafio, sorteia outro ambiente) |
| I | Volta para a tela inicial |
| P | Reagir ao evento (replantar, tratar o esgoto…) |
| S | Liga/desliga o painel de simulação |
| R | **Modo revisão**: mostra na ficha as notas dos dados marcados `validar` |
| M | Som liga/desliga |
| F | Tela cheia |

O modo revisão também liga com `index.html?revisao`.

## 2. Montar o leitor

Veja [`firmware/LIGACAO.md`](firmware/LIGACAO.md) para os pinos. Depois grave o firmware:

```bash
cd firmware
pio run -t upload
pio device monitor      # confira: PRONTO, depois UID:04... ao encostar uma tag
```

Para usar a IDE Arduino, siga as instruções no topo de `src/main.cpp`.

Feche o monitor serial e clique em **Conectar leitor** na página. Na próxima vez, a página reconecta sozinha à porta já autorizada.

## 3. Cadastrar os peixes impressos

1. Conecte o leitor e ligue a simulação (**S**). O painel mostra o **Último UID lido**.
2. Encoste o peixe. Vai aparecer "não reconheço esse peixe" e o UID no painel. Clique em **Copiar**.
3. Cole o UID em `especies.json`. Dá para manter o placeholder junto:
   ```json
   "uid": ["SIM-01", "04A1B2C3D4E5F6"]
   ```
   Uma lista também serve se houver mais de um peixe impresso da mesma espécie.

## 4. Revisão biológica

`web/especies.json` tem 14 espécies candidatas: 11 nativas (4 delas predadoras: traíra, saicanga, jacundá e muçum) e 3 exóticas (tilápia, tucunaré e bagre-africano). Toda entrada com `"validar": true` traz uma `notas_validacao` dizendo o que conferir, como ocorrência na bacia, taxonomia, categoria de ameaça ou nome popular local. Só **acará** está como `validar: false`. Os status de ameaça incertos estão como `NE` (não avaliada), não como chute.

Os campos que o jogo usa para pontuar são `guilda_trofica`, `habitat`, `porte`, `come`, `nativo`, `endemico`, `migrador` e `status_ameaca`. O bloco `visual` é só a aparência do desenho.

## Painel admin (`web/admin.html`)

Abre pela tela inicial do jogo (⚙️ Painel admin). Lá dá para editar todas as espécies num formulário: nomes, UIDs, guilda, porte, dieta, habitats, ambientes, eventos, textos da ficha, fotos, cores e notas de validação. Ele também:
- avisa erros, como UID repetido, nome científico repetido ou falta de guilda, e não deixa salvar com erro;
- **📡 Ler do leitor:** conecta o leitor NFC e coloca o UID do peixe encostado na espécie aberta;
- **▶ Testar no jogo:** abre o jogo com o rascunho, só no seu navegador, antes de salvar;
- guarda o rascunho no navegador enquanto você edita.

Há duas formas de salvar:
1. **⬇ Baixar especies.json:** substitua o arquivo `web/especies.json` do projeto. No GitHub, abra o arquivo, clique em editar ou arraste o arquivo novo.
2. **☁ Salvar no GitHub:** faz o commit direto pela API do GitHub, inclusive com o site no GitHub Pages. Precisa de um *token* pessoal *fine-grained* com acesso só a este repositório e a permissão **Contents: Read and write**. Crie em github.com/settings/personal-access-tokens/new. O token fica só no navegador, e só fica guardado se você marcar "lembrar". O Pages leva 1 ou 2 minutos para atualizar. O cache do navegador pode segurar a versão antiga por até 10 minutos; se acontecer, recarregue com Ctrl+F5.

Qualquer pessoa pode abrir o painel, mas sem o token ninguém consegue alterar o repositório.

## Relatório do fim da rodada

O cartão final explica a rodada inteira, não só a nota:
- **O que ajudou / O que atrapalhou:** todas as causas ao mesmo tempo, com os pontos perdidos em cada uma (exótico −25, predadores demais −20…).
- **Cada peixe:** o papel na teia, quem ele comeu, quem comeu ele, e se não sobreviveu no ambiente ou sofreu com o evento.
- **Como foi a rodada:** linha do tempo com cada peixe, o evento e a reação, mostrando quanto cada jogada mudou a saúde. Mostra o efeito real mesmo quando a saúde já está em 0.

O texto vem de `Regras.explicar()` em `regras.js`.

## 5. Ajustar ambientes e evento

Em `web/ambientes.js`, cada ambiente define os habitats, os alimentos da teia, a meta própria (brejo 65, represa 45, porque poucos nativos vivem bem ali) e o visual. Os eventos também ficam lá. O bloco `CONFIG` define a chance de evento (70%) e depois de qual peixe ele acontece (2º ou 3º).

Em `especies.json`, o campo `ambientes` diz onde cada espécie vive bem, e o campo `sofre_com` diz com quais eventos ela sofre. Os dois foram preenchidos a partir do habitat e estão marcados para revisão. No Desafio, um peixe fora do seu ambiente **não sobrevive**: continua no rio, mas apagado, e não conta para a cadeia alimentar nem para a riqueza.

## 6. Ajustar as regras

Tudo fica em `web/regras.js`, no bloco `CONFIG`:

- **Equilíbrio da cadeia alimentar (35)**: quantas guildas diferentes há, se existe base da cadeia (detritívoro/herbívoro nativo) e a pirâmide.
- **Teia desequilibrada tira pontos direto da saúde:**
  - sem predador (com 3 peixes ou mais): −15
  - predadores demais para as presas: −20
  - cada predador sem nenhuma presa menor que ele: −15
  - poucas presas por predador: −8

  Os valores ficam nas linhas `penalidade…` do `CONFIG`.
- **Habitats ocupados (20)**: corrente, remanso e lago com pelo menos um nativo.
- **Peixes nativos (25)**: proporção de nativos. Cada exótica ainda tira `penalidadePorExotica` (25) pontos da saúde final.
- **Espécies especiais (20)**: endêmicos, ameaçados (VU/EN/CR) e migradores.
- Comunidades com menos de `riquezaIdeal` (5) espécies têm a saúde reduzida.
- Rodada: `maxPeixesPorRodada` (5) e `metaSaude` (70).
- No Desafio valem os pesos de `pesosDesafio`, que incluem **Adaptação ao ambiente (30)**.

A teia alimentar sai da dieta de cada espécie: o campo `come` em `especies.json` ou, sem ele, a dieta padrão da guilda. Um peixe que come `"peixes"` só come espécies de **porte menor** que o dele.

## Fotos dos peixes

**Foto real (embaixo da descrição):** com internet, rode na pasta do projeto:

```bash
python3 ferramentas/baixar_fotos.py           # baixa as que faltam
python3 ferramentas/baixar_fotos.py --forcar  # busca tudo de novo
```

O script procura cada espécie no Wikimedia Commons pelo termo de `foto_busca` e salva a foto em `web/img/fotos/`. Também grava `foto_credito`, `foto_licenca` e `foto_fonte` no `especies.json`, e a ficha mostra o crédito embaixo da foto. **Confira se cada foto é mesmo da espécie certa.** Se não for, coloque o nome exato do arquivo do Commons em `foto_arquivo` e rode de novo com `--forcar`.

Fotos próprias do projeto também servem: salve com o nome do campo `foto` e preencha o crédito à mão. Sem foto, nada aparece para o público. No modo revisão (**R**) aparece um aviso de que a foto falta.

**Ilustração (no alto da ficha):** coloque imagens em `web/img/` com o nome indicado no campo `imagem`, por exemplo `img/lambari.png`. PNG com fundo transparente fica melhor. Sem imagem, a ficha desenha o peixe automaticamente.

## Requisitos

- Chrome ou Edge (desktop) por causa da Web Serial API. Firefox e Safari não têm.
- Funciona por `file://` ou `http://localhost`. Não precisa de internet: a fonte do Google é opcional e, sem conexão, o navegador usa uma fonte do sistema.
