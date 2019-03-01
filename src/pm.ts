"use strict";

module.exports = pixelmatch;

function pixelmatch(
  img1: Uint8Array,
  img2: Uint8Array,
  output: Uint8Array, // Mutable
  width: number,
  height: number,
  options?: {
    threshold?: number;
    includeAA?: boolean; // antialised
  }
) {
  if (img1.length !== img2.length) throw new Error("Image sizes do not match.");

  if (!options) {
    options = {};
  }

  const threshold = options.threshold === undefined ? 0.1 : options.threshold;

  // maximum acceptable square distance between two colors;
  // 35215 is the maximum possible value for the YIQ difference metric
  let maxDelta: number = 35215 * threshold * threshold;
  let diff: number = 0;

  // compare each pixel of one image against the other one
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = (y * width + x) * 4;

      // squared YUV distance between colors at this pixel position
      const delta = colorDelta(img1, img2, pos, pos);

      // the color difference is above the threshold
      if (delta > maxDelta) {
        // check it's a real rendering difference or just anti-aliasing
        if (
          !options.includeAA &&
          (antialiased(img1, x, y, width, height, img2) ||
            antialiased(img2, x, y, width, height, img1))
        ) {
          // one of the pixels is anti-aliasing; draw as yellow and do not count as difference
          if (output) {
            drawPixel(output, pos, 255, 255, 0);
          }
        } else {
          // found substantial difference not caused by anti-aliasing; draw it as red
          if (output) {
            drawPixel(output, pos, 255, 0, 0);
          }
          diff++;
        }
      } else if (output) {
        // pixels are similar; draw background as grayscale image blended with white
        const val = grayPixel(img1, pos, 0.1);
        drawPixel(output, pos, val, val, val);
      }
    }
  }

  // return the number of different pixels
  return diff;
}

// check if a pixel is likely a part of anti-aliasing;
// based on "Anti-aliased Pixel and Intensity Slope Detector" paper by V. Vysniauskas, 2009

function antialiased(
  img1: Uint8Array,
  x1: number,
  y1: number,
  width: number,
  height: number,
  img2: Uint8Array
): boolean {
  const x0 = Math.max(x1 - 1, 0);
  const y0 = Math.max(y1 - 1, 0);
  const x2 = Math.min(x1 + 1, width - 1);
  const y2 = Math.min(y1 + 1, height - 1);
  const pos = (y1 * width + x1) * 4;
  let zeroes: number = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;
  let min = 0;
  let max = 0;
  let minX, minY, maxX, maxY;

  // go through 8 adjacent pixels
  for (let x = x0; x <= x2; x++) {
    for (let y = y0; y <= y2; y++) {
      if (x === x1 && y === y1) {
        continue;
      }

      // brightness delta between the center pixel and adjacent one
      let delta = colorDelta(img1, img1, pos, (y * width + x) * 4, true);

      // count the number of equal, darker and brighter adjacent pixels
      if (delta === 0) {
        zeroes++;
        // if found more than 2 equal siblings, it's definitely not anti-aliasing
        if (zeroes > 2) return false;

        // remember the darkest pixel
      } else if (delta < min) {
        min = delta;
        minX = x;
        minY = y;

        // remember the brightest pixel
      } else if (delta > max) {
        max = delta;
        maxX = x;
        maxY = y;
      }
    }
  }

  // if there are no both darker and brighter pixels among siblings, it's not anti-aliasing
  if (min === 0 || max === 0) return false;

  // if either the darkest or the brightest pixel has 3+ equal siblings in both images
  // (definitely not anti-aliased), this pixel is anti-aliased
  return (
    (hasManySiblings(img1, minX as number, minY as number, width, height) &&
      hasManySiblings(img2, minX as number, minY as number, width, height)) ||
    (hasManySiblings(img1, maxX as number, maxY as number, width, height) &&
      hasManySiblings(img2, maxX as number, maxY as number, width, height))
  );
}

// check if a pixel has 3+ adjacent pixels of the same color.
function hasManySiblings(
  img: Uint8Array,
  x1: number,
  y1: number,
  width: number,
  height: number
) {
  const x0 = Math.max(x1 - 1, 0);
  const y0 = Math.max(y1 - 1, 0);
  const x2 = Math.min(x1 + 1, width - 1);
  const y2 = Math.min(y1 + 1, height - 1);
  let pos = (y1 * width + x1) * 4;
  let zeroes = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;

  // go through 8 adjacent pixels
  for (let x = x0; x <= x2; x++) {
    for (let y = y0; y <= y2; y++) {
      if (x === x1 && y === y1) {
        continue;
      }

      const pos2 = (y * width + x) * 4;
      if (
        img[pos] === img[pos2] &&
        img[pos + 1] === img[pos2 + 1] &&
        img[pos + 2] === img[pos2 + 2] &&
        img[pos + 3] === img[pos2 + 3]
      )
        zeroes++;

      if (zeroes > 2) {
        return true;
      }
    }
  }

  return false;
}

// calculate color difference according to the paper "Measuring perceived color difference
// using YIQ NTSC transmission color space in mobile applications" by Y. Kotsarenko and F. Ramos

function colorDelta(
  img1: Uint8Array,
  img2: Uint8Array,
  k: number,
  m: number,
  yOnly?: boolean
): number {
  let r1 = img1[k + 0];
  let g1 = img1[k + 1];
  let b1 = img1[k + 2];
  let a1 = img1[k + 3];

  let r2 = img2[m + 0];
  let g2 = img2[m + 1];
  let b2 = img2[m + 2];
  let a2 = img2[m + 3];

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

  // yiq's y
  const y = rgb2y(r1, g1, b1) - rgb2y(r2, g2, b2);

  if (yOnly) {
    return y; // brightness difference only
  }

  // yiq's i
  const i = rgb2i(r1, g1, b1) - rgb2i(r2, g2, b2);

  // yiq's q
  const q = rgb2q(r1, g1, b1) - rgb2q(r2, g2, b2);

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

// blend semi-transparent color with white
function blend(c: number, a: number): number {
  return 255 + (c - 255) * a;
}

function drawPixel(
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
