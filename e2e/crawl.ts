import "@babel/polyfill";
import puppeteer from "puppeteer";
import { sample } from "lodash";
declare var $monkey: any;

type SerializedDOM = [string, object, number[]];

const pageErrors: Error[] = [];
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function pathsToSelector(paths: number[], root = "body") {
  return paths.reduce(
    (expr, next) => `${expr} > *:nth-child(${next + 1})`,
    root
  );
}

function selectRandomNodeWithBias(serialized: SerializedDOM[]): SerializedDOM {
  if (Math.random() < 0.5) {
    const item = serialized.find(([t]) => t === "form");
    if (item) {
      return item;
    }
  }
  return sample(serialized) as SerializedDOM;
}

(async () => {
  const browser = await puppeteer.launch({ headless: false, devtools: true });

  try {
    const logs = [];
    const page = await browser.newPage();

    page.on("console", msg => {
      logs.push(msg.args());
    });

    page.on("load", async () => {
      const scriptText = `
      const __install = ${install.toString()}
      __install();
      `;

      await page.evaluate(scriptText => {
        eval(scriptText);
      }, scriptText);
    });

    page.on("pageerror", async error => {
      pageErrors.push(error);
    });

    await page.goto("http://localhost:1234/form");
    await page.waitFor("body");

    let cnt = 10000;
    while (cnt--) {
      // await wait(300);

      const serialized = await page.evaluate(() => {
        return $monkey.serializeDomState();
      });
      // console.log("serialized", serialized);

      const state = selectRandomNodeWithBias(serialized);

      await execRandomAction(page, state, serialized);

      await wait(300);
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
  [tag, _attrs, paths]: SerializedDOM,
  allData: SerializedDOM[]
): Promise<void> {
  if (["div", "span"].includes(tag)) {
    return execRandomAction(page, sample(allData) as SerializedDOM, allData);
  }

  switch (tag) {
    case "form": {
      const inputOrButtonList = allData
        .filter(([, , childPaths]) => {
          const formRoot = paths.join(",");
          return childPaths.join(",").includes(formRoot);
        })
        .filter(([tag]) => {
          return ["input", "button"].includes(tag);
        });
      for (const [t, _a, _paths] of inputOrButtonList) {
        if (t === "button") {
          // TODO: submit
        }
        if (t === "input") {
          // @ts-ignore
          if (_a.type === "number") {
            await page.type(
              pathsToSelector(_paths),
              Math.floor(Math.random() * 100).toString()
            );
          }
          // @ts-ignore
          if (_a.type != null || _a.type === "text") {
            await page.type(pathsToSelector(_paths), Math.random().toString());
          }
        }
      }

      await page.$eval(pathsToSelector(paths), (form: any) => form.submit());
      break;
    }

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
