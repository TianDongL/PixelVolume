"""Build the static download page from verified release metadata and the app UI."""
import argparse
import html
import json
import re
import shutil
from pathlib import Path

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
shutil.copytree(root/'website'/'assets', args.out/'assets', dirs_exist_ok=True)
page = (root/'website'/'index.html').read_text(encoding='utf-8')
original = (root/'windows'/'SliderResident.html').read_text(encoding='utf-8')
original = original.replace('lang="ja"', 'lang="zh-CN"').replace('value="72"', 'value="42"')
styles = re.findall(r'<style>([\s\S]*?)</style>', original)
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', original)
if len(styles) != 1 or len(scripts) != 1:
    raise ValueError('Unexpected source UI structure')
markup = original.split('<style>', 1)[0]
page = page.replace('__DEMO_MARKUP__', markup)
for name, value in values.items():
    page = page.replace('__'+name+'__', html.escape(str(value), quote=True))
if re.search(r'__[A-Z_]+__', page):
    raise ValueError('Unresolved page placeholders')
(args.out/'index.html').write_text(page, encoding='utf-8')
(args.out/'release.json').write_bytes(release_bytes)
bridge = '''
const demoSlider=document.querySelector('.range');const demoLevel=document.querySelector('#demo-level');
demoSlider.setAttribute('aria-label','网页音量效果预览，不改变系统音量');
const showLevel=()=>{demoLevel.textContent=demoSlider.value+'%';demoSlider.setAttribute('aria-valuetext',demoSlider.value+'%')};
demoSlider.addEventListener('input',showLevel);showLevel();
'''
(args.out/'assets'/'demo.css').write_text(styles[0], encoding='utf-8')
(args.out/'assets'/'demo.js').write_text(scripts[0]+bridge, encoding='utf-8')
old_demo = args.out/'assets'/'demo.html'
if old_demo.exists():
    old_demo.unlink()
shutil.copyfile(root/'licenses'/'SliderResident-MIT.txt', args.out/'assets'/'SliderResident-MIT.txt')
print(f'Built download page for {version}: {args.out}')
