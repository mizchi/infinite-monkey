const CHROME_IE_STACK_REGEXP = /^\s*at .*(\S+\:\d+|\(native\))/m;

// https://github.com/stacktracejs/error-stack-parser/blob/master/error-stack-parser.js
// for v8 or ie
export function parseStacktrace(stacktrace: string) {
  const filtered = stacktrace.split("\n").filter(line => {
    return !!line.match(CHROME_IE_STACK_REGEXP);
  });

  return filtered.map(line => {
    if (line.indexOf("(eval ") > -1) {
      // Throw away eval information until we implement stacktrace.js/stackframe#8
      line = line
        .replace(/eval code/g, "eval")
        .replace(/(\(eval at [^\()]*)|(\)\,.*$)/g, "");
    }
    const tokens: string[] = line
      .replace(/^\s+/, "")
      .replace(/\(eval code/g, "(")
      .split(/\s+/)
      .slice(1);
    const locationParts = extractLocation(tokens.pop() as string);
    const functionName = tokens.join(" ") || undefined;
    const fileName =
      ["eval", "<anonymous>"].indexOf(locationParts[0] as any) > -1
        ? undefined
        : locationParts[0];

    return {
      functionName: functionName,
      fileName: fileName,
      lineNumber: locationParts[1],
      columnNumber: locationParts[2],
      source: line
    };
  });
}

function extractLocation(urlLike: string): Array<string | void> {
  // Fail-fast but return locations like "(native)"
  if (urlLike.indexOf(":") === -1) {
    return [urlLike];
  }

  const regExp = /(.+?)(?:\:(\d+))?(?:\:(\d+))?$/;
  const parts = regExp.exec(urlLike.replace(/[\(\)]/g, "")) as string[];
  return [parts[1], parts[2] || undefined, parts[3] || undefined];
}
