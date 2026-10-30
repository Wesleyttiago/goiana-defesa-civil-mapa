"""Converte o GeoPackage público do SGB de Goiana em GeoJSON para o mapa.
Uso: python scripts/preparar-camadas-sgb.py /caminho/suscetibilidade.gpkg
Manutenção apenas: requer shapely e pyproj. Não participa do build do site.
"""
import hashlib
import json
import sqlite3
import sys
from pathlib import Path
from pyproj import Transformer
from shapely import force_2d, from_wkb, from_geojson
from shapely.geometry import mapping
from shapely.ops import transform

origem = Path(sys.argv[1])
destino = Path(__file__).resolve().parents[1] / 'public' / 'camadas'
destino.mkdir(parents=True, exist_ok=True)
conexao = sqlite3.connect(f'file:{origem}?mode=ro', uri=True)
conexao.row_factory = sqlite3.Row
camadas = [
    ('Inundacao_A', 'inundacao', 'CLASSE', 'suscetibilidade'),
    ('Movimento_de_Massa_A', 'movimento', 'CLASSE', 'suscetibilidade'),
    ('Litologia_100Mil_A', 'geologia', 'legenda', 'geologia'),
]
colecoes = {'suscetibilidade': [], 'geologia': []}
for tabela, camada, atributo, arquivo in camadas:
    srs = conexao.execute('SELECT srs_id FROM gpkg_geometry_columns WHERE table_name=?', (tabela,)).fetchone()[0]
    para_metros = Transformer.from_crs(srs, 31985, always_xy=True).transform
    para_wgs84 = Transformer.from_crs(31985, 4326, always_xy=True).transform
    for registro in conexao.execute(f'SELECT fid, geom, "{atributo}" FROM "{tabela}"'):
        blob = registro['geom']
        assert blob[:2] == b'GP'
        envelope = (blob[3] >> 1) & 7
        tamanho_envelope = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[envelope]
        geometria = force_2d(from_wkb(blob[8 + tamanho_envelope:]))
        assert not geometria.is_empty and geometria.is_valid
        geometria = transform(para_wgs84, transform(para_metros, geometria).simplify(10, preserve_topology=True))
        assert geometria.is_valid
        xmin, ymin, xmax, ymax = geometria.bounds
        assert -36 < xmin < xmax < -34 and -9 < ymin < ymax < -6, geometria.bounds
        propriedades = {'id': f'{camada}-{registro["fid"]}', 'camada': camada,
            'descricao': registro[atributo], 'fonte': 'SGB', 'ano': 2025}
        def arredondar(valor):
            if isinstance(valor, (list, tuple)):
                return [arredondar(x) for x in valor]
            return round(valor, 6) if isinstance(valor, float) else valor
        geojson = mapping(geometria)
        compacto = {**geojson, 'coordinates': arredondar(geojson['coordinates'])}
        if not from_geojson(json.dumps(compacto)).is_valid:
            compacto = geojson
        colecoes[arquivo].append({'type': 'Feature', 'id': propriedades['id'],
            'properties': propriedades, 'geometry': compacto})
for nome, features in colecoes.items():
    dados = {'type': 'FeatureCollection', 'features': features}
    texto = json.dumps(dados, ensure_ascii=False, separators=(',', ':'))
    caminho = destino / f'{nome}-goiana.geojson'
    caminho.write_text(texto, encoding='utf-8')
    print(f'{caminho.name}: {len(features)} feições, {caminho.stat().st_size} bytes')
metadata = {'fonte': 'Serviço Geológico do Brasil', 'item': 'https://rigeo.sgb.gov.br/handle/doc/25401',
    'titulo': 'Carta de suscetibilidade a movimentos gravitacionais de massa e inundação: município de Goiana - PE',
    'autores': ['Gilmar Dias Pauli', 'Rafaelly Rocha Cavalcanti de Lira', 'Guilherme Terra'],
    'ano': 2025, 'escalaCarta': '1:45.000', 'escalaGeologia': '1:100.000',
    'geopackageSha256': hashlib.sha256(origem.read_bytes()).hexdigest(),
    'transformacao': 'Subconjunto de Inundacao_A, Movimento_de_Massa_A e Litologia_100Mil_A. Simplificação de 10 m com preservação de topologia em EPSG:31985; reprojeção para EPSG:4326 e arredondamento a 6 casas quando a geometria permanece válida. Classes originais mantidas.',
    'limiteDeUso': 'Referência territorial. Não é previsão de cheias nem avaliação de risco de uma residência. A priorização de equipes depende de validação da Defesa Civil.'}
(destino / 'fontes-sgb.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
