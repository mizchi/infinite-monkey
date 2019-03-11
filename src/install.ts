import { SerializedNode } from "./types";

// eval in borwser scope
export function install() {
  function serializeDomState() {
    const results: SerializedNode[] = [];
    function _walk(node: HTMLElement, paths: number[]) {
      const attrs = Array.from(node.attributes).reduce(
        (acc, attr) => ({ ...acc, [attr.nodeName]: attr.value }),
        {}
      );

      results.push({ tag: node.tagName.toLowerCase(), attrs, paths });

      if (node.childNodes && node.childNodes.length > 0) {
        Array.from(node.childNodes)
          // Drop Text Node
          .filter(n => n instanceof HTMLElement)
          .map((child, index) => {
            _walk(child as HTMLElement, paths.concat([index]));
          });
      }
    }

    _walk(document.body, []);
    return results;
  }

  const g: any = window;
  g.$monkey = {
    // execRandomAction,
    serializeDomState
  };
}
