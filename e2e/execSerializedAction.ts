import "@babel/polyfill";
import puppeteer from "puppeteer";
import { sample } from "lodash";
declare var $monkey: any;

const pageErrors: Error[] = [];
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function pathsToSelector(paths: number[], root = "body") {
  return paths.reduce(
    (expr, next) => `${expr} > *:nth-child(${next + 1})`,
    root
  );
}

(async () => {
  const browser = await puppeteer.launch({ headless: false, devtools: true });

  try {
    const logs = [];
    const page = await browser.newPage();

    page.on("console", msg => {
      logs.push(msg.args());
    });

    page.on("pageerror", async error => {
      pageErrors.push(error);
    });

    await page.goto("http://localhost:1234");
    // await page.setViewport({ width: 400, height: 600 });
    await page.waitFor("body");
    const scriptText = `
    const __install = ${install.toString()}
    __install();
    `;

    await page.evaluate(scriptText => {
      eval(scriptText);
    }, scriptText);

    let cnt = 10;
    while (cnt--) {
      const serialized = await page.evaluate(() => {
        return $monkey.serializeDomState();
      });

      const state = sample(serialized);

      await execRandomAction(page, state);

      await wait(500);
    }
    await browser.close();
  } catch (error) {
    console.error("error", error);
    console.error("pageErrors", pageErrors);

    await browser.close();
  }
})();

async function execRandomAction(
  page: puppeteer.Page,
  [tag, _attrs, paths]: SerializedDOM
) {
  switch (tag) {
    case "button":
    case "a": {
      const selector = pathsToSelector(paths);
      await page.click(selector);
      break;
    }
  }
}

// eval in borwser scope
function install() {
  function serializeDomState() {
    const ret: SerializedDOM[] = [];
    function _walk(node: HTMLElement, paths: number[]) {
      const attrs = Array.from(node.attributes).reduce(
        (acc, attr) => ({ ...acc, [attr.nodeName]: attr.value }),
        {}
      );

      ret.push([node.tagName.toLowerCase(), attrs, paths]);

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
    return ret;
  }

  const g: any = window;
  g.$monkey = {
    // execRandomAction,
    serializeDomState
  };
}

type SerializedDOM = [string, object, number[]];
