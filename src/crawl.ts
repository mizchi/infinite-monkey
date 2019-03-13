import "@babel/polyfill";
import fs from "fs";
import puppeteer from "puppeteer";
import url from "url";
import path from "path";
import { execAction } from "./actionSelector";
import { install } from "./install";
import { visitedUrlMap, wait } from "./utils";
// import log from "log";
// import debug from "debug";
// const logger = debug("monkey");
const log = (...args: any) => console.log("[monkey]", ...args);

const argv = require("minimist")(process.argv.slice(2));

const entryUrl = argv._[0];
const interval = argv.interval || 100;
const maxAction = argv.maxAction || 100;
const maxRetry = argv.maxRetry || 3;
const noHeadless = argv.noHeadless || false;

const parsedEntry = url.parse(entryUrl);

if (!entryUrl) {
  throw new Error("Specify entry");
}

const logPath = path.join(process.cwd(), "monkey.log");

(async () => {
  await fs.promises.unlink(logPath).catch(e => log("log initialize"));

  const browser = await puppeteer.launch({
    headless: !noHeadless,
    devtools: true
    // args: ["--no-sandbox"]
  });

  let retlyCount = maxRetry;
  while (retlyCount--) {
    console.log("step", retlyCount);
    let currentPage: puppeteer.Page | null = null;
    try {
      currentPage = await browser.newPage();

      await Promise.all([
        currentPage.coverage.startJSCoverage()
        // currentPage.coverage.startCSSCoverage()
      ]);

      await runActionUntilErrorOrExpire(browser, currentPage, maxAction);
    } catch (error) {
      // console.log("terminate with", error);
      if (currentPage) {
        // @ts-ignore
        const errorLog = `Terminate by error: ${currentPage.url()}: ${error.toString()} \n`;
        log("Terminate(Error):", errorLog);
        await fs.promises.appendFile(logPath, errorLog);
        // console.log("terminated by error", currentPage.url(), error);
      }
    } finally {
      if (currentPage) {
        const [jsCoverage, cssCoverage] = await Promise.all([
          currentPage.coverage.stopJSCoverage()
          // currentPage.coverage.stopCSSCoverage()
        ]);

        let totalBytes = 0;
        let usedBytes = 0;
        // const coverage = [...jsCoverage, ...cssCoverage];
        const coverage = [...jsCoverage];

        for (const entry of coverage) {
          totalBytes += entry.text.length;
          for (const range of entry.ranges)
            usedBytes += range.end - range.start - 1;
        }
        log(`Bytes used: ${(usedBytes / totalBytes) * 100}%`);
        await currentPage.close();
      }
    }
  }
  await browser.close();
})();

async function runActionUntilErrorOrExpire(
  _browser: puppeteer.Browser,
  page: puppeteer.Page,
  maxAction: number
) {
  log("runAction");
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
      await Promise.race([page.waitFor("body"), wait(1000 * 12)]);

      let restActionCount = maxAction;
      // let counter = maxAction;
      log("start");

      while (restActionCount-- > 0) {
        // console.log("start");
        // await page.waitFor("body");
        await Promise.race([page.waitFor("body"), wait(1000 * 5)]);
        // log("restAction", restActionCount);

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
      resolve();
    } catch (error) {
      log("reject on action", error);

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
