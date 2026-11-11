"""Build the static download page from verified release metadata and the app UI."""
import argparse
import hashlib
import html
import json
import re
import shutil
from pathlib import Path

def write_demo_asset(assets, suffix, content):
    data = content.encode('utf-8')
    digest = hashlib.sha256(data).hexdigest()[:16]
    path = assets / f'demo-{digest}.{suffix}'
    path.write_bytes(data)
    return f'assets/{path.name}'


root = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--release', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
args = p.parse_args()
release_bytes = args.release.read_bytes()
release = json.loads(release_bytes)
version = release['version']
if not re.fullmatch(r'(0|[1-9]\d{0,5})(\.(0|[1-9]\d{0,5})){2}', version):
    raise ValueError('Invalid release version')
values = {'VERSION': version}
for platform, label, suffix in [('windows-x64', 'WINDOWS', 'Windows-x64-Setup.exe'), ('macos-universal', 'MAC', 'macOS-Universal.dmg')]:
    item = release['platforms'][platform]
    if not re.fullmatch(r'[a-f0-9]{64}', item['sha256']) or not 0 < item['size'] <= 1073741824:
        raise ValueError('Invalid artifact metadata')
    expected = f'https://norgateai.com/pixel-volume/releases/{version}/{item["sha256"]}/PixelVolume-{version}-{suffix}'
    if item['url'] != expected:
        raise ValueError('Unexpected download URL')
    cdn_expected = f'https://dl.norgateai.com/download/releases/pixel-volume/{version}/{item["sha256"]}/PixelVolume-{version}-{suffix}'
    if 'cdnUrl' in item and item['cdnUrl'] != cdn_expected:
        raise ValueError('Unexpected CDN URL')
    values.update({label+'_URL': item.get('cdnUrl', expected), label+'_HASH': item['sha256'], label+'_SIZE': f'{item["size"]/1000000:.1f} MB' if item['size'] >= 1000000 else f'{round(item["size"]/1000)} KB'})
args.out.mkdir(parents=True, exist_ok=True)
assets = args.out/'assets'
shutil.copytree(root/'website'/'assets', assets, dirs_exist_ok=True)
page = (root/'website'/'index.html').read_text(encoding='utf-8')
original = (root/'macos'/'SliderResident.html').read_text(encoding='utf-8')
original = original.replace('lang="ja"', 'lang="zh-CN"').replace('value="72"', 'value="40"')
styles = re.findall(r'<style>([\s\S]*?)</style>', original)
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', original)
if len(styles) != 1 or len(scripts) != 1:
    raise ValueError('Unexpected source UI structure')
scenes = root/'scenes'
host = (scenes/'SceneHost.html').read_text(encoding='utf-8')
scene_host = re.fullmatch(r'\s*<style>(.*?)</style>\s*<script>(.*?)</script>\s*', host, re.S)
if not scene_host:
    raise ValueError('Unexpected scene host structure')
scene_style, scene_script = scene_host.groups()
bridge = '''
const demoSlider = document.querySelector('.preview-room .range');
const demoLevel = document.querySelector('#demo-level');
demoSlider.setAttribute('aria-label', '网页音量效果预览，不改变系统音量');
function showLevel() {
  const percentage = demoSlider.value + '%';
  demoLevel.textContent = percentage;
  demoSlider.setAttribute('aria-valuetext', percentage);
}
demoSlider.addEventListener('input', showLevel);
showLevel();
window.pixelScenes.select({ kind: 'village' });
window.pixelScenes.setVisible(true);
'''
demo = '\n'.join([
    (scenes/'Village.bundle.js').read_text(encoding='utf-8'),
    'window.VillageScene = VillageScene;',
    (scenes/'VillagePosters.js').read_text(encoding='utf-8'),
    scene_script,
    scripts[0],
    bridge,
])
values['DEMO_STYLE'] = write_demo_asset(assets, 'css', styles[0] + '\n' + scene_style)
values['DEMO_SCRIPT'] = write_demo_asset(assets, 'js', demo)
markup = original.split('<style>', 1)[0]
page = page.replace('__DEMO_MARKUP__', markup)
for name, value in values.items():
    page = page.replace('__'+name+'__', html.escape(str(value), quote=True))
if re.search(r'__[A-Z_]+__', page):
    raise ValueError('Unresolved page placeholders')
(args.out/'index.html').write_text(page, encoding='utf-8')
(args.out/'release.json').write_bytes(release_bytes)
old_demo = assets/'demo.html'
if old_demo.exists():
    old_demo.unlink()
for license_name in ('SliderResident-MIT.txt', 'Three-MIT.txt'):
    shutil.copyfile(root/'licenses'/license_name, assets/license_name)
print(f'Built download page for {version}: {args.out}')
