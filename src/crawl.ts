import "@babel/polyfill";
import fs from "fs";
import puppeteer from "puppeteer";
import url from "url";
import path from "path";
import { execAction } from "./actionSelector";
import { install } from "./install";
import { visitedUrlMap, wait } from "./utils";

const entryUrl = process.argv[2];
const interval = 0;
const parsedEntry = url.parse(entryUrl);

const logPath = path.join(process.cwd(), "monkey.log");

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
      await runActionUntilError(browser, currentPage);
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

async function runActionUntilError(
  _browser: puppeteer.Browser,
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
          if (
            !t.includes("Download the React DevTools") &&
            !(t.indexOf("font-weight:bold") > -1) &&
            !(t.indexOf("JSHandle@array") > -1)
          ) {
            // console.log("console:", t);
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
