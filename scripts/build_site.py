"""Build the Pages artifact exclusively from the public site directory."""
from pathlib import Path
import runpy,shutil
root=Path(__file__).resolve().parents[1]
runpy.run_path(str(root/'scripts/validate_site.py'),run_name='__main__')
output=root/'_site'
if output.exists():shutil.rmtree(output)
shutil.copytree(root/'site',output)
(output/'.nojekyll').touch()
print('Built GitHub Pages artifact: _site/')
