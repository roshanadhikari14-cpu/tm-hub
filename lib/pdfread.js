// Reads a Lighthouse report PDF: the text of each page and the photos on chosen pages.
// Photos come out as JPEG (scaled down to keep requests small).
const path = require('path');
const jpeg = require('jpeg-js');

let pdfjs;
async function lib() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'file:///' + path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs').replace(/\\/g, '/');
  }
  return pdfjs;
}

async function open(buf) {
  const p = await lib();
  return p.getDocument({ data: new Uint8Array(buf), disableFontFace: true, useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise;
}

// Text of every page, as ['line', ...] per page. Items on one line are joined by their positions.
async function pagesText(doc) {
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const lines = [];
    let cur = '';
    let prev = null;
    const flush = () => {
      if (cur.trim()) lines.push(cur.trim());
      cur = '';
      prev = null;
    };
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const x = it.transform[4], y = it.transform[5], h = it.height || 10;
      if (prev && Math.abs(y - prev.y) > h * 0.6) flush();
      if (prev && it.str) {
        const gap = x - prev.end;
        if (gap > h * 0.18 && !cur.endsWith(' ') && !it.str.startsWith(' ')) cur += ' ';
      }
      cur += it.str;
      if (it.str) prev = { y, end: x + (it.width || 0) };
      if (it.hasEOL) flush();
    }
    flush();
    out.push(lines.map((l) => l.replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/\s{2,}/g, ' ')));
  }
  return out;
}

// Raw pdf.js image → RGBA → scaled JPEG (base64).
function toJpeg(img, maxW = 900) {
  const { width: w, height: h, data, kind } = img;
  if (!w || !h || !data) return null;
  const px = w * h;
  const rgba = Buffer.alloc(px * 4);
  if (kind === 3 || data.length === px * 4) {
    Buffer.from(data.buffer, data.byteOffset, px * 4).copy(rgba);
  } else if (kind === 2 || data.length === px * 3) {
    for (let i = 0, j = 0; i < px; i++, j += 3) {
      rgba[i * 4] = data[j];
      rgba[i * 4 + 1] = data[j + 1];
      rgba[i * 4 + 2] = data[j + 2];
      rgba[i * 4 + 3] = 255;
    }
  } else return null;
  // Box downscale to at most maxW wide.
  const s = Math.max(1, Math.ceil(w / maxW));
  const nw = Math.floor(w / s), nh = Math.floor(h / s);
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < s; dy++)
        for (let dx = 0; dx < s; dx++) {
          const k = ((y * s + dy) * w + (x * s + dx)) * 4;
          r += rgba[k];
          g += rgba[k + 1];
          b += rgba[k + 2];
        }
      const n = s * s, o = (y * nw + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  // Colour and brightness tell a photo of a notebook from a plain question image.
  let sat = 0, lum = 0, flat = 0;
  const n = nw * nh;
  for (let i = 0; i < n; i++) {
    const r = out[i * 4], g = out[i * 4 + 1], b = out[i * 4 + 2];
    const l = (r + g + b) / 3;
    sat += Math.max(r, g, b) - Math.min(r, g, b);
    lum += l;
    if (l < 20 || l > 242) flat++; // pure black or pure white: typical of a slide, rare in a photo of a notebook
  }
  return { b64: jpeg.encode({ data: out, width: nw, height: nh }, 72).data.toString('base64'), w: nw, h: nh, sat: sat / n, lum: lum / n, flat: flat / n };
}

// Photos on one page (skips small images such as icons and the logo).
async function pagePhotos(doc, pageNo, minSide = 160) {
  const p = await lib();
  const page = await doc.getPage(pageNo);
  const ops = await page.getOperatorList();
  const photos = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== p.OPS.paintImageXObject) continue;
    const name = ops.argsArray[i][0];
    // Images used on more than one page live in the shared store ("g_" names).
    const store = String(name).startsWith('g_') ? page.commonObjs : page.objs;
    const img = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), 4000);
      try {
        store.get(name, (v) => {
          clearTimeout(t);
          resolve(v);
        });
      } catch {
        clearTimeout(t);
        resolve(null);
      }
    });
    if (!img || Math.min(img.width, img.height) < minSide) continue;
    const j = toJpeg(img);
    if (j) photos.push(j);
  }
  return photos;
}

module.exports = { open, pagesText, pagePhotos };
