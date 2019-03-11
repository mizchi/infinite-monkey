import url from "url";

export function wait(n: number) {
  return new Promise(r => setTimeout(r, n));
}

export function toSelector(paths: number[], root = "body") {
  return paths.reduce(
    (expr, next) => `${expr} > *:nth-child(${next + 1})`,
    root
  );
}

export const visitedUrlMap: { [key: string]: boolean } = {};

const entryUrl = process.argv[2];
const interval = 0;

export const parsedEntry = url.parse(entryUrl);
