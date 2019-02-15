import "@babel/polyfill";
import puppeteer from "puppeteer";
import { parseStacktrace } from "../src/parseChromeStacktrace";
const pageErrors: Error[] = [];

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", async error => {
    pageErrors.push(error);
  });

  await page.goto("http://localhost:1234");
  await page.waitFor("body");

  await browser.close();
  for (const error of pageErrors) {
    const stack = parseStacktrace(error.toString());
    console.log(
      stack.map(
        s => `${s.fileName}:${s.lineNumber}:${s.columnNumber}:${s.functionName}`
      )
    );
  }
})();
