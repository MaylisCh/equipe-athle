"""Read-only import of the original workbook. Output is confined to this site's seed.json."""
import json
import re
from datetime import date, timedelta
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent
NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def workbook(path):
    with ZipFile(path) as z:
        shared = [''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rels = {e.get('Id'): e.get('Target') for e in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets = {}
        for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('x:sheets/x:sheet', NS):
            target = rels[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            cells = {}
            for c in ET.fromstring(z.read(path)).findall('.//x:sheetData/x:row/x:c', NS):
                value = c.find('x:v', NS)
                if value is not None and value.text:
                    cells[c.get('r')] = shared[int(value.text)] if c.get('t') == 's' else value.text
            sheets[sheet.get('name')] = cells
        return sheets

def category(text):
    t = text.lower()
    if 'repos' == t.strip(): return 'rest'
    if any(x in t for x in ['championnat', 'meeting']): return 'competition'
    if 'muscu' in t: return 'strength'
    if any(x in t for x in ['v02', 'vo2', 'vma']): return 'vo2'
    if any(x in t for x in ['montsouris', 'cité u', 'parc de sceaux', 'côte']): return 'hills'
    if any(x in t for x in ['vitesse longue', 'endu', 'capa', 'condition physique']): return 'endurance'
    if any(x in t for x in ['vitesse', 'sprint', 'accélération', 'haies']): return 'speed'
    return 'group'

def main():
    files = list(ROOT.parent.glob('Saison hivernale*.xlsx'))
    if len(files) != 1: raise SystemExit('Un seul classeur Saison hivernale attendu.')
    sheets = workbook(files[0])
    sessions = []
    for sheet, cells in sheets.items():
        if not sheet.lower().startswith('cycle'): continue
        for address, heading in cells.items():
            if not re.fullmatch(r'[A-Z]+1', address) or 'Semaine' not in heading: continue
            match = re.search(r'(\d{1,2})/(\d{1,2})', heading)
            if not match: continue
            day, month = map(int, match.groups())
            start = date(2026 if month >= 9 else 2027, month, day)
            col = address[:-1]
            for offset in range(7):
                raw = cells.get(f'{col}{offset + 2}', '').strip()
                if not raw: continue
                dt = start + timedelta(days=offset)
                first = raw.splitlines()[0].strip()
                item = dict(id=f'{sheet}-{col}-{offset}', date=dt.isoformat(), title=first,
                            type=category(raw), warmup='', workout=raw, v2='', targets=[],
                            cycle=sheet, sourceText=raw, coachNote='', version=1)
                if dt == date(2026,9,28):
                    item.update(title='Technique course & accélération', warmup='Renfo + gammes (travail latéral sur haies) + med. ball',
                                workout='Technique course : vitesse gestuelle avec ou sans haies — technique transmission du témoin en relais 4×100\nVitesse : accélération en palier\n6×50 m (20+20+10) 60 %–80 %–90 %, r 2 min')
                elif dt == date(2026,9,29):
                    item.update(workout="2×(2′/1′30 – 1′/1′ – 3′), R 5′\n(12′)\nIntensité 55 %", v2="2×(2′/1′30 – 1′/1′ – 1′30) — (9′)", coachNote='Référence du 55 % à préciser avant de calculer une distance cible pour cette séance chronométrée.')
                elif dt == date(2026,10,1):
                    item.update(warmup="Travail technique du départ trépied à l’échauffement", workout="(2×250 + 2×200) 80 %, r 1′30, R 6′\n(800)", v2='4×200 m à 80 %', targets=[{'distance':250,'percent':80},{'distance':200,'percent':80}], coachNote='À vérifier : le classeur indique (800), mais 2×250 + 2×200 totalise 900 m. Consigne source conservée.')
                sessions.append(item)
    seed = {'sessions': sessions}
    (ROOT/'seed.json').write_text(json.dumps(seed, ensure_ascii=False, indent=2)+'\n')
    print(f'{len(sessions)} journées importées, du {min(x["date"] for x in sessions)} au {max(x["date"] for x in sessions)}. Documents source ouverts en lecture seule.')

if __name__ == '__main__': main()
