import "@babel/polyfill";
import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const WIDTH = 800;
  const HEIGHT = 600;

  await page.goto("http://localhost:1234/counter");
  await page.setViewport({ width: WIDTH, height: HEIGHT });
  await page.waitFor("body");

  await page.screenshot({
    path: `${__dirname}/diff/a.png`
  });

  await page.click("button");

  await page.screenshot({
    path: `${__dirname}/diff/b.png`
  });

  await page.click("a");
  await page.waitFor("body");
  await page.screenshot({
    path: `${__dirname}/diff/c.png`
  });

  await browser.close();
})();
