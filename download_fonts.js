const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const fontUrl = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=Noto+Sans+SC:wght@400;500;600;700&family=ZCOOL+XiaoWei&family=Noto+Serif+Traditional+Chinese:wght@400;600;700;900&display=swap';
const cssPath = path.join(__dirname, 'css', 'fonts.css');
const fontDir = path.join(__dirname, 'assets', 'fonts');
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': userAgent
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function localizeFonts(css) {
  const regex = /url\((https:\/\/[^)]+)\)/g;
  const urls = [];
  let match;

  while ((match = regex.exec(css)) !== null) {
    urls.push(match[1]);
  }

  return [...new Set(urls)];
}

function buildFilename(url, index) {
  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname) || '.woff2';
  return `font-${index}${ext}`;
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  let css = '';

  if (fs.existsSync(cssPath)) {
    css = fs.readFileSync(cssPath, 'utf-8');
  }

  if (!/url\((https:\/\/[^)]+)\)/.test(css)) {
    css = await fetchText(fontUrl);
  }

  const urls = localizeFonts(css);
  if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });

  let localCss = css;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const filename = buildFilename(url, i);
    const filepath = path.join(fontDir, filename);
    await downloadFile(url, filepath);
    localCss = localCss.split(url).join(`../assets/fonts/${filename}`);
  }

  fs.writeFileSync(cssPath, localCss);
  console.log(`Fonts downloaded: ${urls.length}`);
}

main().catch((error) => {
  console.error('Failed to download fonts:', error);
  process.exitCode = 1;
});
