"""Extrai somente a geometria municipal e setores históricos públicos, sem dados de moradores.
Uso: python scripts/extrair-territorio-goiana.py PE_Municipios_2025.zip sig_goiana_pe_risco.zip
Manutenção: requer pyshp. Não participa do build React.
Fontes: IBGE (malha 2025) e SGB https://rigeo.sgb.gov.br/handle/doc/19968 (março/2014).
"""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
import shapefile

RAIZ = Path(__file__).resolve().parents[1]
municipios, setores = map(Path, sys.argv[1:3])

def leitor(arquivo, nome, encoding):
    z = zipfile.ZipFile(arquivo)
    return shapefile.Reader(shp=io.BytesIO(z.read(nome + '.shp')),
                            dbf=io.BytesIO(z.read(nome + '.dbf')), encoding=encoding)

def salvar(arquivo, objeto):
    (RAIZ / arquivo).write_text(json.dumps(objeto, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

goiana = next(item for item in leitor(municipios, 'PE_Municipios_2025', 'utf-8').iterShapeRecords()
              if str(item.record.as_dict()['CD_MUN']) == '2606200')
assert goiana.record.as_dict()['NM_MUN'] == 'Goiana'
salvar('src/data/limite-goiana.json', {'type': 'Feature', 'properties': {
    'nome': 'Goiana', 'codigoIbge': '2606200', 'ano': 2025, 'fonte': 'IBGE',
    'url': 'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2025/UFs/PE/PE_Municipios_2025.zip',
    'sha256ArquivoFonte': hashlib.sha256(municipios.read_bytes()).hexdigest(),
}, 'geometry': goiana.shape.__geo_interface__})

features = []
for item in leitor(setores, 'Shape/PE_GOI_SR_CPRM_atualizado', 'latin1').iterShapeRecords():
    p = item.record.as_dict()
    assert p['MUNIC'] == 'Goiana' and p['UF'] == 'PE'
    features.append({'type': 'Feature', 'properties': {'id': p['NUM_SETOR'], 'camada': 'historico',
        'descricao': p['LOCAL'], 'processo': p['TIPOLOGIA'], 'grauHistorico': p['GRAU_RISCO'],
        'ano': 2014, 'fonte': 'SGB / CPRM', 'url': 'https://rigeo.sgb.gov.br/handle/doc/19968'},
        'geometry': item.shape.__geo_interface__})
assert len(features) == 3
salvar('public/camadas/setores-historicos-goiana.geojson', {'type': 'FeatureCollection', 'features': features})
