"""Gera 500 famílias fictícias em áreas urbanas suscetíveis de Goiana.
Uso: python scripts/gerar-familias-demonstracao.py /caminho/base_cartografica.gpkg
Manutenção apenas: requer shapely e pyproj. Não participa do build do site.
Não usa dados de moradores nem consulta APIs durante a execução.
"""
import collections
import hashlib
import json
import math
import random
import sqlite3
import sys
from pathlib import Path
from pyproj import Transformer
from shapely import from_wkb, transform as reprojetar
from shapely.geometry import shape, Point, mapping
from shapely.ops import unary_union
from shapely.strtree import STRtree

RAIZ = Path(__file__).resolve().parents[1]
BASE = Path(sys.argv[1])
SEMENTE = 20261030
rng = random.Random(SEMENTE)
para_metros = Transformer.from_crs(4674, 31985, always_xy=True).transform
para_geo = Transformer.from_crs(31985, 4326, always_xy=True).transform
def projetar(geometria, transformacao):
    return reprojetar(geometria, transformacao, interleaved=False)
def ler_geometria(blob):
    assert blob[:2] == b'GP'
    envelope = (blob[3] >> 1) & 7
    return projetar(from_wkb(blob[8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[envelope]:]), para_metros)
def salvar(nome, objeto):
    (RAIZ / 'public' / nome).write_text(json.dumps(objeto, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

conexao = sqlite3.connect(f'file:{BASE}?mode=ro', uri=True)
conexao.row_factory = sqlite3.Row
assert conexao.execute('SELECT geocodigo FROM LOC_Cidade_P').fetchone()[0] == '2606200'
urbanos = [(r['fid'], ler_geometria(r['geom'])) for r in conexao.execute('SELECT fid, geom FROM Area_Edificada_A')]
localidades = [(r['identificador'], ler_geometria(r['geom'])) for r in conexao.execute('SELECT identificador,geom FROM LOC_Localidades_P')]
localidades += [('Goiana', ler_geometria(r[0])) for r in conexao.execute('SELECT geom FROM LOC_Cidade_P')]
referencias = {fid: min(localidades, key=lambda lugar: lugar[1].distance(g.representative_point()))[0] for fid, g in urbanos}
rios = unary_union([ler_geometria(r['geom']).buffer(70 if r['waterway'] == 'river' else 18) for r in conexao.execute('SELECT geom,waterway FROM HID_Trecho_Drenagem_L')])
ruas = [(r['fid'], r['name'], ler_geometria(r['geom'])) for r in conexao.execute("SELECT fid,name,geom FROM TRA_Trecho_Rodoviario_L WHERE highway IN ('residential','living_street','unclassified')")]
pistas = unary_union([ler_geometria(r[0]).buffer(5) for r in conexao.execute('SELECT geom FROM TRA_Trecho_Rodoviario_L')])
geologia = json.loads((RAIZ / 'public/camadas/geologia-goiana.geojson').read_text())['features']
mangue_praia = unary_union([projetar(shape(f['geometry']), para_metros) for f in geologia if f['properties']['descricao'].startswith(('Mangue recente', 'Praia:'))])
permitido = unary_union([g for _, g in urbanos]).difference(rios).difference(pistas).difference(mangue_praia)
originais = json.loads((RAIZ / 'public/camadas/suscetibilidade-goiana.geojson').read_text())['features']
zonas = [(f['properties'], projetar(shape(f['geometry']), para_metros)) for f in originais if f['properties']['descricao'] in ['Alta', 'Média']]
arvore = STRtree([g for _, g in zonas])
candidatos = []
for rua_id, rua_nome, geometria in ruas:
    for linha in getattr(geometria, 'geoms', [geometria]):
        if linha.geom_type != 'LineString' or linha.length < 15:
            continue
        for passo in range(8, int(linha.length) - 5, 12):
            centro = linha.interpolate(passo)
            antes, depois = linha.interpolate(max(0, passo - 1)), linha.interpolate(min(linha.length, passo + 1))
            dx, dy = depois.x - antes.x, depois.y - antes.y
            norma = math.hypot(dx, dy)
            if not norma:
                continue
            for lado in [-1, 1]:
                afastamento = rng.uniform(11, 30)
                posicao = Point(centro.x - lado * dy / norma * afastamento, centro.y + lado * dx / norma * afastamento)
                if not permitido.contains(posicao):
                    continue
                geog = projetar(posicao, para_geo)
                longitude, latitude = round(geog.x, 6), round(geog.y, 6)
                posicao = projetar(Point(longitude, latitude), para_metros)
                if not permitido.contains(posicao):
                    continue
                correspondencias = [zonas[int(i)] for i in arvore.query(posicao) if zonas[int(i)][1].contains(posicao)]
                if not correspondencias:
                    continue
                correspondencias.sort(key=lambda a: (a[0]['descricao'] != 'Alta', a[0]['camada'] != 'inundacao'))
                area = correspondencias[0][0]
                nucleo = next(fid for fid, g in urbanos if g.contains(posicao))
                candidatos.append({'latitude': latitude, 'longitude': longitude, 'xy': [posicao.x, posicao.y], 'nucleo': nucleo, 'area': area, 'rua': rua_nome, 'ruaId': rua_id})

# Distribuição por ocupação urbana, com prioridade para as manchas altas existentes.
rng.shuffle(candidatos)
candidatos.sort(key=lambda c: c['area']['descricao'] != 'Alta')
selecionados = []
grade = collections.defaultdict(list)
def adicionar(candidato):
    x, y = candidato['xy']
    cx, cy = math.floor(x / 14), math.floor(y / 14)
    for i in range(cx - 1, cx + 2):
        for j in range(cy - 1, cy + 2):
            if any(math.hypot(x - a, y - b) < 14 for a, b in grade[(i, j)]):
                return False
    grade[(cx, cy)].append((x, y))
    selecionados.append(candidato)
    return True
for nucleo, alvo in [(1, 310), (3, 35), (6, 15), (4, 140)]:
    contagem = 0
    for candidato in candidatos:
        if candidato['nucleo'] == nucleo and adicionar(candidato):
            contagem += 1
            if contagem == alvo:
                break
if len(selecionados) < 500:
    for candidato in candidatos:
        if adicionar(candidato) and len(selecionados) == 500:
            break
assert len(selecionados) == 500, 'A base urbana não comportou o total solicitado com os critérios espaciais.'

NOMES_INICIAIS = ['Ana Clara Santos', 'José Carlos Almeida', 'Maria Lúcia Ferreira', 'Paulo Henrique Lima', 'Juliana Beatriz Costa', 'Antônio Marcos Silva', 'Cláudia Regina Souza', 'Ricardo Luís Oliveira', 'Helena Duarte Pereira', 'João Pedro Barbosa', 'Camila Azevedo Rocha', 'Francisco André Gomes', 'Patrícia Nunes Martins', 'Marcos Vinícius Araújo', 'Luciana Mendes Ribeiro', 'Carlos Eduardo Batista', 'Beatriz Melo Andrade', 'Raimundo César Dias', 'Eliane Cristina Teixeira', 'Rafael Augusto Moreira', 'Fernanda Lira Carvalho', 'Pedro Lucas Freitas', 'Márcia Gabriela Monteiro', 'Daniel Vieira Lopes', 'Sônia Raquel Campos', 'Luís Fernando Cavalcanti', 'Renata Alves Cardoso', 'Bruno Matias Correia', 'Sandra Cristina Mendes', 'Eduardo Miguel Ramos', 'Adriana Paiva Fonseca', 'Felipe Augusto Torres', 'Cristiane Leal Santana', 'Gustavo César Moura', 'Simone Pereira Barros', 'Roberto Sérgio Xavier', 'Aline Duarte Farias', 'André Luiz Cunha', 'Rosana Bezerra Melo', 'Tiago Daniel Neves', 'Vanessa Pinheiro Brito', 'Leandro José Dantas', 'Débora Cristina Maciel', 'Diego Rafael Pires', 'Lúcia Helena Nascimento', 'Marcelo Antônio Queiroz', 'Cecília Maria Tavares', 'Vinícius Rodrigues Reis', 'Isabel Cristina Soares', 'Alexandre Neto Miranda']
primeiros = ['Alice', 'Amanda', 'André', 'Beatriz', 'Bruno', 'Camila', 'Carolina', 'Daniel', 'Débora', 'Diego', 'Eduardo', 'Elaine', 'Elisa', 'Felipe', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Isabela', 'Joana', 'Júlia', 'Larissa', 'Leonardo', 'Letícia', 'Lucas', 'Luísa', 'Marcelo', 'Mariana', 'Natália', 'Paulo', 'Pedro', 'Rafael', 'Renata', 'Roberto', 'Sara', 'Simone', 'Sofia', 'Thiago', 'Valéria', 'Vinícius']
sobrenomes = ['Almeida', 'Andrade', 'Araújo', 'Barbosa', 'Batista', 'Cavalcanti', 'Costa', 'Dias', 'Duarte', 'Ferreira', 'Freitas', 'Gomes', 'Lima', 'Lopes', 'Macedo', 'Martins', 'Melo', 'Mendes', 'Monteiro', 'Moraes', 'Nascimento', 'Nunes', 'Oliveira', 'Pereira', 'Ramos', 'Ribeiro', 'Rocha', 'Santana', 'Santos', 'Silva', 'Soares', 'Souza', 'Teixeira', 'Vieira']
nomes = list(NOMES_INICIAIS)
while len(nomes) < 500:
    nome = f'{rng.choice(primeiros)} {rng.choice(sobrenomes)} {rng.choice(sobrenomes)}'
    if nome not in nomes:
        nomes.append(nome)
# A avaliação da família é inteiramente simulada e não é calculada pela classe SGB.
niveis = ['alto'] * 300 + ['medio'] * 150 + ['baixo'] * 50
rng.shuffle(niveis)
pontos = []
for indice, candidato in enumerate(selecionados):
    area = candidato['area']
    pontos.append({'id': f'exemplo-{indice + 1:04d}', 'nomeRepresentante': nomes[indice], 'latitude': candidato['latitude'], 'longitude': candidato['longitude'], 'nivelRisco': niveis[indice],
        'resumoDemonstrativo': {'moradores': rng.choices([1, 2, 3, 4, 5, 6, 7], [10, 20, 22, 25, 15, 7, 1])[0],
        'referenciaLocal': f"Proximidades de {candidato['rua']}" if candidato['rua'] else 'Proximidades de via residencial sem nome na base cartográfica',
        'nucleo': f"Núcleo {candidato['nucleo']:02d} · Próximo de {referencias[candidato['nucleo']]}",
        'areaSgb': {'id': area['id'], 'classe': area['descricao'], 'camada': area['camada']}}})
salvar('dados-exemplo.json', pontos)
# Base pequena usada nos testes de localização. Não é carregada junto com o mapa.
areas = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'nucleo': fid}, 'geometry': mapping(projetar(g, para_geo))} for fid, g in urbanos]}
salvar('demonstracao/areas-edificadas.geojson', areas)
contagens = collections.Counter(f"{p['area']['camada']}:{p['area']['descricao']}" for p in selecionados)
metadata = {'quantidade': 500, 'semente': SEMENTE, 'natureza': 'Famílias, nomes, moradores e avaliações de risco inteiramente fictícios.',
    'fonteTerritorial': 'https://rigeo.sgb.gov.br/handle/doc/25401', 'anoPublicacao': 2025,
    'baseCartograficaSha256': hashlib.sha256(BASE.read_bytes()).hexdigest(),
    'municipioVerificado': {'nome': 'Goiana–PE', 'geocodigo': '2606200'},
    'criterios': ['Dentro de área edificada da base SGB', 'Dentro de classe Alta ou Média de inundação ou movimento de massa', 'Pontos aproximados de 11 a 30 m do eixo de vias locais', 'Excluídos os buffers de 70 m dos eixos de rios e 18 m dos demais cursos de água', 'Excluídos os buffers de 5 m das vias e as unidades de mangue e praia', 'Espaçamento mínimo de 14 m entre pontos'],
    'pontosPorContexto': dict(contagens), 'pontosPorNucleo': dict(collections.Counter(p['nucleo'] for p in selecionados)),
    'atribuicaoViasEHidrografia': '© OpenStreetMap contributors. Vias e hidrografia integrantes da base cartográfica distribuída pelo SGB. Dados derivados de OSM disponíveis sob ODbL: https://www.openstreetmap.org/copyright',
    'limiteDeUso': 'Localizações aproximadas para simulação em áreas urbanas suscetíveis. Não são residências, moradores ou cadastros verificados. Buffers técnicos não definem margem oficial, APP ou zona de segurança. A classe territorial não determina automaticamente o risco de uma residência.'}
salvar('demonstracao/fontes.json', metadata)
print(json.dumps({'familias': len(pontos), 'contextos': dict(contagens), 'nucleos': metadata['pontosPorNucleo']}, ensure_ascii=False))
