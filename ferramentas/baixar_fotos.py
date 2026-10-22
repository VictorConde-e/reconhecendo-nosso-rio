#!/usr/bin/env python3
"""
Baixa uma foto real de cada peixe do Wikimedia Commons (licença livre)
e grava crédito, licença e link no web/especies.json.

Uso (na pasta do projeto, com internet):
    python3 ferramentas/baixar_fotos.py            # baixa só as fotos que faltam
    python3 ferramentas/baixar_fotos.py --forcar   # busca e baixa tudo de novo
    python3 ferramentas/baixar_fotos.py --so traira cambeva

Para cada espécie, o script procura no Commons o termo de "foto_busca".
Para escolher um arquivo exato, coloque no JSON, por exemplo:
    "foto_arquivo": "File:Hoplias malabaricus.jpg"

IMPORTANTE: confira se cada foto é mesmo da espécie certa. A busca é automática.
Também dá para usar fotos próprias do projeto: salve em web/img/fotos/<nome>.jpg
(o nome está no campo "foto") e preencha foto_credito e foto_licenca à mão.
Só usa a biblioteca padrão do Python.
"""
import argparse
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"
JSON = WEB / "especies.json"
API = "https://commons.wikimedia.org/w/api.php"
AGENTE = "ReconhecendoNossoRio/1.0 (jogo educativo de extensao universitaria)"
LARGURA = 800

# arquivos que quase nunca são uma foto do peixe vivo
EVITAR = re.compile(r"map|mapa|range|distribu|skeleton|esqueleto|drawing|desenho|illustra|ilustra|"
                    r"plate|prancha|logo|stamp|selo|\.svg|\.tif", re.I)


def pedir(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def texto_limpo(valor):
    return html.unescape(re.sub(r"<[^>]+>", "", valor or "")).strip()


def info_arquivos(params):
    dados = pedir({**params, "prop": "imageinfo", "iiprop": "url|extmetadata|mime", "iiurlwidth": LARGURA})
    paginas = (dados.get("query") or {}).get("pages") or {}
    saida = []
    for pg in sorted(paginas.values(), key=lambda p: p.get("index", 0)):
        ii = (pg.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata") or {}
        saida.append({
            "titulo": pg.get("title", ""),
            "mime": ii.get("mime", ""),
            "url": ii.get("thumburl") or ii.get("url"),
            "pagina": ii.get("descriptionurl", ""),
            "autor": texto_limpo((meta.get("Artist") or {}).get("value")),
            "licenca": texto_limpo((meta.get("LicenseShortName") or {}).get("value")),
        })
    return saida


def escolher(especie):
    if especie.get("foto_arquivo"):
        return next(iter(info_arquivos({"titles": especie["foto_arquivo"]})), None)
    termo = especie.get("foto_busca") or especie["nome_cientifico"]
    candidatos = info_arquivos({
        "generator": "search", "gsrsearch": f'"{termo}" filetype:bitmap',
        "gsrnamespace": 6, "gsrlimit": 20,
    })
    palavras = [p.lower() for p in termo.split()]
    bons = [c for c in candidatos
            if c["url"] and c["mime"] in ("image/jpeg", "image/png") and not EVITAR.search(c["titulo"])]
    # prefere arquivos com o nome da espécie no título
    bons.sort(key=lambda c: -sum(p in c["titulo"].lower() for p in palavras))
    return bons[0] if bons else None


def baixar(url, destino):
    req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(req, timeout=60) as r:
        destino.write_bytes(r.read())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--forcar", action="store_true", help="busca e baixa de novo mesmo se a foto já existir")
    ap.add_argument("--so", nargs="*", help="só estas espécies (parte do nome do arquivo, ex.: traira)")
    args = ap.parse_args()

    dados = json.loads(JSON.read_text(encoding="utf-8"))
    resumo = []
    for e in dados["especies"]:
        if not e.get("foto"):
            continue
        destino = WEB / e["foto"]
        if args.so and not any(s in destino.stem for s in args.so):
            continue
        if destino.exists() and not args.forcar:
            resumo.append(f"= {e['nome_popular']}: já existe ({e['foto']})")
            continue
        try:
            arq = escolher(e)
            if not arq:
                resumo.append(f"! {e['nome_popular']}: nenhuma foto encontrada para '{e.get('foto_busca')}'")
                continue
            destino.parent.mkdir(parents=True, exist_ok=True)
            baixar(arq["url"], destino)
        except Exception as erro:  # rede, arquivo removido etc.
            resumo.append(f"! {e['nome_popular']}: erro ({erro})")
            continue
        e["foto_arquivo"] = arq["titulo"]
        e["foto_credito"] = arq["autor"] or "Autor desconhecido"
        e["foto_licenca"] = arq["licenca"]
        e["foto_fonte"] = arq["pagina"]
        resumo.append(f"+ {e['nome_popular']}: {arq['titulo']} ({arq['licenca']}, {arq['autor']})\n    {arq['pagina']}")

    JSON.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("\n".join(resumo))
    print("\nConfira cada foto (é a espécie certa?) e o crédito antes de usar no jogo.")


if __name__ == "__main__":
    sys.exit(main())
