// ランダムにそれっぽく HTML を操作する puppeteer スクリプト
//
// Install an Run
// $ yarn add ts-node puppeteer -D
// $ yarn ts-node -T crawl.ts http://localhost:1234
import "@babel/polyfill";
import puppeteer from "puppeteer";
import { sample, range } from "lodash";
import fs from "fs";
import url from "url";
declare var $monkey: any;

const entryUrl = process.argv[2];
const interval = 0;

const parsedEntry = url.parse(entryUrl);
// console.log("entryUrl", entryUrl);

const visitedUrlMap: { [key: string]: boolean } = {};

// type SerializedNode = [string, object, number[]];
type SerializedNode = { tag: string; attrs: any; paths: number[] };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function toSelector(paths: number[], root = "body") {
  return paths.reduce(
    (expr, next) => `${expr} > *:nth-child(${next + 1})`,
    root
  );
}

function selectRandomNodeWithBias(allNodes: SerializedNode[]): SerializedNode {
  const formNodes = allNodes.filter(node => node.tag === "form");
  // prefer form node
  if (formNodes.length > 0) {
    if (Math.random() < 0.7) {
      return sample(formNodes) as SerializedNode;
    }
  }

  const effectableNodes = allNodes.filter(node =>
    ["button", "input", "textarea", "select"].includes(node.tag)
  );

  if (effectableNodes.length > 0) {
    if (Math.random() < 0.7) {
      return sample(effectableNodes) as SerializedNode;
    }
  }

  return sample(allNodes) as SerializedNode;
}
const logPath = __dirname + "/monkey.log";

(async () => {
  await fs.promises.unlink(logPath).catch(e => console.log("initialize"));

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true
    // args: ["--no-sandbox"]
  });

  while (true) {
    let currentPage: puppeteer.Page | null = null;
    try {
      currentPage = await browser.newPage();
      await execActionUntilError(browser, currentPage);
    } catch (error) {
      // console.log("terminate with", error);
      if (currentPage) {
        const errorLog = `Terminate by error: ${currentPage.url()}: ${error.toString()} \n`;
        await fs.promises.appendFile(logPath, errorLog);
        // console.log("terminated by error", currentPage.url(), error);
        currentPage.close();
      }
    }
  }
  browser.close();
})();

async function execActionUntilError(
  browser: puppeteer.Browser,
  page: puppeteer.Page
) {
  return new Promise(async (resolve, reject) => {
    try {
      // setup pages
      page.on("console", async msg => {
        const args = msg.args();
        for (let i = 0; i < args.length; ++i) {
          const t = `${args[i]}`.replace(/^(JSHandle\:)/, "");
          // Ignore react devtools prompt
          if (!t.includes("Download the React DevTools")) {
            console.log("console:", t);
          }
        }
      });
      page.on("pageerror", async error => {
        reject(error);
      });
      page.on("load", async () => {
        const scriptText = `const __install = ${install.toString()};__install();`;
        await page.evaluate(scriptText => {
          eval(scriptText);
        }, scriptText);
      });
      await page.goto(entryUrl);
      await page.waitFor("body");

      let cnt = 10000;
      while (cnt--) {
        await page.waitFor("body");
        const parsed = url.parse(page.url());
        if (parsed.hostname !== parsedEntry.hostname) {
          reject(new Error(`Do not allow external hostname`));
        }

        visitedUrlMap[parsed.pathname as string] = true;

        await ensurePageScript(page);
        const nodes = await page.evaluate(() => {
          return $monkey.serializeDomState();
        });
        await execAction(page, nodes);
        await wait(interval);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function fillInput(
  page: puppeteer.Page,
  node: SerializedNode,
  allNodes: SerializedNode[]
) {
  if (node.attrs.type === "submit") {
    // submit later
    return;
  }
  // text
  if (node.attrs.type != null || node.attrs.type === "text") {
    await page.type(toSelector(node.paths), Math.random().toString());
    return;
  }

  // number
  if (node.attrs.type === "radio") {
    await page.click(toSelector(node.paths));
    return;
  }

  // number
  if (node.attrs.type === "number") {
    await page.type(
      toSelector(node.paths),
      Math.floor(Math.random() * 100).toString()
    );
    return;
  }
}

async function fillTextarea(
  page: puppeteer.Page,
  node: SerializedNode,
  allNodes: SerializedNode[]
) {
  await page.type(toSelector(node.paths), Math.random().toString());
}

async function selectRandomOption(
  page: puppeteer.Page,
  node: SerializedNode,
  allNodes: SerializedNode[]
) {
  const optionNodes = getChildNodes(node, allNodes).filter(
    n => n.tag === "option"
  );
  const randomValue = sample(optionNodes.map(n => n.attrs.value));
  await page.select(toSelector(node.paths), randomValue);
}

async function fillFormAndSubmit(
  page: puppeteer.Page,
  node: SerializedNode,
  allNodes: SerializedNode[]
) {
  // handle input
  const inputList = getChildNodes(node, allNodes).filter(child => {
    return child.tag === "input";
  });
  for (const input of inputList) {
    await fillInput(page, input, allNodes);
  }

  // select
  const selectNodes = getChildNodes(node, allNodes).filter(child => {
    return child.tag === "select";
  });
  for (const selectNode of selectNodes) {
    await selectRandomOption(page, selectNode, allNodes);
  }

  await page.$eval(toSelector(node.paths), (form: any) => form.submit());
}

function getChildNodes(node: SerializedNode, allNodes: SerializedNode[]) {
  return allNodes.filter(child => {
    const nodePath = node.paths.join("/");
    const childPath = child.paths.join("/");
    return nodePath !== childPath && childPath.includes(nodePath);
  });
}

async function execAction(page: puppeteer.Page, allData: SerializedNode[]) {
  const rand = Math.random();
  // if (rand < 0.7) {
  //   // select prefered action
  //   await execPreferredAction(page, allData);
  // } else
  if (rand < 0.6) {
    const node = selectRandomNodeWithBias(allData);
    await execActionByRandomNode(page, node, allData);
  } else {
    await execRandomAction(page, allData);
  }
}

async function execPreferredAction(
  page: puppeteer.Page,
  allData: SerializedNode[]
) {
  const anchorNodes = allData.filter(node => node.tag === "a");
  const node = anchorNodes.find(node => {
    const anchorHrefParsed = url.parse(node.attrs.href);
    console.log(anchorHrefParsed);
    const isPathnameVisited = !!visitedUrlMap[parsedEntry.pathname as string];
    return (
      // 相対パス
      (anchorHrefParsed.hostname == null && !isPathnameVisited) ||
      // 同じホストかつ visitedUrlMap に登録されていない
      (anchorHrefParsed.hostname === parsedEntry.hostname && !isPathnameVisited)
    );
  });

  if (node) {
    console.log("selected node", node);
  }
  if (node) {
    await page.click(toSelector(node.paths));
  } else {
    await execRandomAction(page, allData);
  }
}

async function execRandomAction(
  page: puppeteer.Page,
  allData: SerializedNode[]
) {
  // monkey mode
  const random = Math.random();
  if (random > 0.95) {
    await dragAndDropRandom(page, allData, 3);
  } else if (random > 0.7) {
    await clickRandomNode(page, allData, 10);
  } else {
    await clickRandomPoint(page, 10);
  }
}

async function dragAndDropRandom(
  page: puppeteer.Page,
  allData: SerializedNode[],
  times: number
) {
  const randomNode = sample(allData) as SerializedNode;

  for (const _ in range(times)) {
    const e = (await page.$(
      toSelector(randomNode.paths)
    )) as puppeteer.ElementHandle<Element>;
    const box = (await e.boundingBox()) as puppeteer.BoundingBox;
    await page.mouse.move(
      box.x + box.width * Math.random(),
      box.y + box.height * Math.random()
    );
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * Math.random(),
      box.y + box.height * Math.random()
    ); // move to (100, 200) coordinates
    await page.mouse.up();
  }
}

async function clickRandomNode(
  page: puppeteer.Page,
  allData: SerializedNode[],
  times: number
) {
  for (const _ in range(times)) {
    sample(allData);

    const w = await page.evaluate(() => window.innerWidth);
    const h = await page.evaluate(() => window.innerHeight);
    await page.mouse.click(w * Math.random(), h * Math.random(), {
      button: "left"
    });
  }
}

async function clickRandomPoint(page: puppeteer.Page, times: number) {
  for (const _ in range(times)) {
    const w = await page.evaluate(() => window.innerWidth);
    const h = await page.evaluate(() => window.innerHeight);
    await page.mouse.click(w * Math.random(), h * Math.random(), {
      button: "left"
    });
  }
}

async function execActionByRandomNode(
  page: puppeteer.Page,
  node: SerializedNode,
  allData: SerializedNode[]
): Promise<void> {
  if (["div", "span"].includes(node.tag)) {
    return execActionByRandomNode(
      page,
      sample(allData) as SerializedNode,
      allData
    );
  }

  switch (node.tag) {
    case "form": {
      await fillFormAndSubmit(page, node, allData);
      break;
    }

    case "select": {
      selectRandomOption(page, node, allData);
      break;
    }

    case "textarea": {
      fillTextarea(page, node, allData);
      break;
    }

    case "input": {
      fillInput(page, node, allData);
      break;
    }

    case "button":
    case "a": {
      const selector = toSelector(node.paths);
      await page.click(selector);
      break;
    }
  }
}

async function ensurePageScript(page: puppeteer.Page) {
  while (true) {
    const installed = await page.evaluate(() => {
      return typeof $monkey === "object";
    });
    if (installed) {
      break;
    } else {
      await wait(32);
    }
  }
}

// eval in borwser scope
function install() {
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
