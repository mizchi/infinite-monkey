const MAX_YIQ_DELTA = 35215;

export default function pixelmatch(
  img1: Uint8Array,
  img2: Uint8Array,
  output: Uint8Array | void, // Mutable
  width: number,
  height: number,
  threshold: number = 0.1
) {
  if (img1.length !== img2.length) {
    throw new Error("Image sizes do not match.");
  }

  // maximum acceptable square distance between two colors;
  // 35215 is the maximum possible value for the YIQ difference metric
  let maxDelta: number = MAX_YIQ_DELTA * threshold * threshold;
  // compare each pixel of one image against the other one
  const deltas = getDeltas(img1, img2);

  let diff = 0;
  for (let i = 0; i < deltas.length; i++) {
    const delta = deltas[i];
    if (maxDelta < delta) {
      diff++;
    }
  }

  // render
  if (output) {
    return render(output, deltas, width, height, maxDelta, img1);
  }

  return diff;
}

// to shader
function getDeltas(img1: Uint8Array, img2: Uint8Array) {
  const buf = new Float32Array(img1.length / 4);
  for (let pos = 0; pos < buf.length; pos++) {
    buf[pos] = getDelta(img1, img2, pos);
  }
  return buf;
}

function getDelta(img1: Uint8Array, img2: Uint8Array, pos: number): number {
  let r1 = img1[pos + 0];
  let g1 = img1[pos + 1];
  let b1 = img1[pos + 2];
  let a1 = img1[pos + 3];

  let r2 = img2[pos + 0];
  let g2 = img2[pos + 1];
  let b2 = img2[pos + 2];
  let a2 = img2[pos + 3];

  // perfect match
  if (a1 === a2 && r1 === r2 && g1 === g2 && b1 === b2) {
    return 0;
  }

  if (a1 < 255) {
    a1 /= 255;
    r1 = blend(r1, a1);
    g1 = blend(g1, a1);
    b1 = blend(b1, a1);
  }

  if (a2 < 255) {
    a2 /= 255;
    r2 = blend(r2, a2);
    g2 = blend(g2, a2);
    b2 = blend(b2, a2);
  }

  // yiq
  // const y = rgb2y(r1, g1, b1) - rgb2y(r2, g2, b2);
  // const i = rgb2i(r1, g1, b1) - rgb2i(r2, g2, b2);
  // const q = rgb2q(r1, g1, b1) - rgb2q(r2, g2, b2);

  const y = rgb2y(r1 - r2, g1 - g2, b1 - b2);
  const i = rgb2i(r1 - r2, g1 - g2, b1 - b2);
  const q = rgb2q(r1 - r2, g1 - g2, b1 - b2);
  // result = yiqMat * ( img1Px - img2Px )
  // return (  vec3(0.5, 0.2, 0.19)  *result ).dot(result)

  // to vector
  return 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q;
}

function rgb2y(r: number, g: number, b: number): number {
  return r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
}
function rgb2i(r: number, g: number, b: number): number {
  return r * 0.59597799 - g * 0.2741761 - b * 0.32180189;
}
function rgb2q(r: number, g: number, b: number): number {
  return r * 0.21147017 - g * 0.52261711 + b * 0.31114694;
}

// --- render ---

// return delta count
function render(
  output: Uint8Array,
  deltas: Float32Array,
  width: number,
  height: number,
  maxDelta: number,
  img1: Uint8Array
) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = (y * width + x) * 4;
      // squared YUV distance between colors at this pixel position
      // const delta = colorDelta(img1, img2, pos);
      const delta = deltas[pos];
      // the color difference is above the threshold
      if (delta > maxDelta) {
        // check it's a real rendering difference or just anti-aliasing
        // found substantial difference not caused by anti-aliasing; draw it as red
        renderPixel(output, pos, 255, 0, 0);
      } else {
        // pixels are similar; draw background as grayscale image blended with white
        const val = grayPixel(img1, pos, 0.1);
        renderPixel(output, pos, val, val, val);
      }
    }
  }
}

function renderPixel(
  output: Uint8Array,
  pos: number,
  r: number,
  g: number,
  b: number
) {
  output[pos + 0] = r;
  output[pos + 1] = g;
  output[pos + 2] = b;
  output[pos + 3] = 255;
}

function grayPixel(img: Uint8Array, i: number, alpha: number) {
  let r = img[i + 0];
  let g = img[i + 1];
  let b = img[i + 2];
  return blend(rgb2y(r, g, b), (alpha * img[i + 3]) / 255);
}

// blend semi-transparent color with white
function blend(c: number, a: number): number {
  return 255 + (c - 255) * a;
}

// run on node

import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

async function loadAsPng(fpath: string): Promise<{ data: Uint8Array }> {
  return new Promise(resolve => {
    const img = fs
      .createReadStream(fpath)
      .pipe(new PNG())
      .on("parsed", (err: Error) => {
        resolve(img);
      });
  });
}

async function main() {
  const [a, b, c] = await Promise.all([
    loadAsPng(path.join(__dirname, "../diff/a.png")),
    loadAsPng(path.join(__dirname, "../diff/b.png")),
    loadAsPng(path.join(__dirname, "../diff/c.png"))
  ]);

  console.time("diff-ab");
  const diff_ab = pixelmatch(a.data, b.data, undefined, 800, 600);
  console.timeEnd("diff-ab");
  console.log("diff_ab", diff_ab);

  console.time("diff-bc");
  const diff_bc = pixelmatch(b.data, c.data, undefined, 800, 600);
  console.timeEnd("diff-bc");
  console.log("diff_bc", diff_bc);
}

main();
