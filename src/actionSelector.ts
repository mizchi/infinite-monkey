import puppeteer from "puppeteer";
import { toSelector, visitedUrlMap, parsedEntry } from "./utils";
import { SerializedNode } from "./types";
import { sample, range } from "lodash";
import url from "url";

export async function execAction(
  page: puppeteer.Page,
  allData: SerializedNode[]
) {
  const rand = Math.random();
  if (rand < 0.7) {
    // select pred action
    await execPreferredAction(page, allData);
  } else if (rand < 0.6) {
    const node = selectRandomNodeWithBias(allData);
    await execActionByRandomNode(page, node, allData);
  } else {
    await execRandomAction(page, allData);
  }
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

// todo select unvisited action
async function execPreferredAction(
  page: puppeteer.Page,
  allData: SerializedNode[]
) {
  const anchorNodes = allData.filter(node => node.tag === "a");
  const node = anchorNodes.find(node => {
    const anchorHrefParsed = url.parse(node.attrs.href);
    // console.log(anchorHrefParsed);
    const isPathnameVisited = !!visitedUrlMap[parsedEntry.pathname as string];
    return (
      // 相対パス
      (anchorHrefParsed.hostname == null && !isPathnameVisited) ||
      // 同じホストかつ visitedUrlMap に登録されていない
      (anchorHrefParsed.hostname === parsedEntry.hostname && !isPathnameVisited)
    );
  });

  // if (node) {
  //   console.log("selected node", node);
  // }
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
    const box = await e.boundingBox();

    if (box) {
      await page.mouse.move(
        box.x + box.width * Math.random(),
        box.y + box.height * Math.random()
      );
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width * Math.random(),
        box.y + box.height * Math.random()
      ); // move to (100, 200) coordinates
    }

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
    case "ex": {
      const selector = toSelector(node.paths);
      await page.click(selector);
      break;
    }
  }
}
