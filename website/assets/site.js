(() => {
  'use strict';
  const suffixes = { 'windows-x64': 'Windows-x64-Setup.exe', 'macos-universal': 'macOS-Universal.dmg' };
  const sizeText = bytes => bytes >= 1000000 ? `${(bytes / 1000000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;
  async function refreshRelease() {
    try {
      const response = await fetch('./release.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      const release = await response.json();
      if (release.schemaVersion !== 1 || release.channel !== 'stable' || !/^(0|[1-9]\d{0,5})(\.(0|[1-9]\d{0,5})){2}$/.test(release.version)) return;
      for (const [platform, suffix] of Object.entries(suffixes)) {
        const file = release.platforms?.[platform];
        if (!file || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 1073741824) return;
        const expected = `https://norgateai.com/pixel-volume/releases/${release.version}/${file.sha256}/PixelVolume-${release.version}-${suffix}`;
        if (file.url !== expected) return;
      }
      for (const node of document.querySelectorAll('[data-version]')) node.textContent = release.version;
      for (const platform of Object.keys(suffixes)) {
        const file = release.platforms[platform];
        document.querySelectorAll(`[data-download="${platform}"]`).forEach(node => { node.href = file.url; });
        document.querySelectorAll(`[data-size="${platform}"]`).forEach(node => { node.textContent = sizeText(file.size); });
        document.querySelectorAll(`[data-hash="${platform}"]`).forEach(node => { node.textContent = file.sha256; });
      }
      document.documentElement.dataset.releaseLoaded = release.version;
    } catch { /* The pre-rendered, verified download links remain usable offline. */ }
  }
  refreshRelease();
})();
