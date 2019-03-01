export function renderAndCountDiff(
  output: Uint8Array,
  deltas: Float32Array,
  width: number,
  height: number,
  maxDelta: number,
  img1: Uint8Array
): number {
  let diff = 0;
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
        drawPixel(output, pos, 255, 0, 0);
        diff++;
      } else {
        // pixels are similar; draw background as grayscale image blended with white
        const val = grayPixel(img1, pos, 0.1);
        drawPixel(output, pos, val, val, val);
      }
    }
  }
  return diff;
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
