"""Check the local public directory and staged-file boundaries before publication."""
from pathlib import Path
import hashlib,json,re,subprocess
root=Path(__file__).resolve().parents[1];site=root/'site';fail=[];checked=0
for p in site.rglob('*'):
 if not p.is_file():continue
 checked+=1
 if p.suffix in {'.blend','.blend1','.zip','.pyc'}or any(s in p.parts for s in ['game_design','game-design','__pycache__']):fail.append('Private file: '+str(p))
 if p.stat().st_size>=100*1024*1024:fail.append('GitHub file size limit: '+str(p))
 if p.suffix not in {'.html','.js','.css'}:continue
 text=p.read_text()
 urls=[]
 if p.suffix=='.html':urls+=re.findall(r'''(?:src|href)=["']([^"']+)["']''',text)
 if p.suffix=='.js':urls+=re.findall(r'''(?:from\s*|import\s*\(|import\s*)['"](\.[^'"]+)['"]''',text)
 if p.suffix=='.css':urls+=re.findall(r'''url\(["']?([^)'"\s]+)''',text)
 for u in urls:
  if u.startswith(('#','http:','https:','data:','blob:')):continue
  path=(p.parent/u.split('?')[0].split('#')[0]).resolve()
  if path.is_dir():path=path/'index.html'
  if not path.is_file():fail.append(str(p.relative_to(root))+': '+u)
manifest=json.loads((site/'game/asset-manifest.json').read_text())
for f in manifest['files']:
 p=site/'game'/f['url'].split('?')[0]
 if not p.exists()or hashlib.sha256(p.read_bytes()).hexdigest()!=f['sha256']:fail.append('Asset mismatch: '+f['url'])
tracked=subprocess.check_output(['git','ls-files','--cached'],cwd=root,text=True).splitlines()
for f in tracked:
 if not (f in ['README.md','.gitignore','.github/workflows/pages.yml','scripts/validate_site.py','scripts/build_site.py']or f.startswith('site/')):fail.append('Unexpected repository file: '+f)
if fail:raise SystemExit('\n'.join(fail))
print(f'Validated {checked} public files, {len(manifest["files"])} asset hashes and repository boundaries.')
