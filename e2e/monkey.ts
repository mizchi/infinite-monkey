import "@babel/polyfill";
import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const WIDTH = 800;
  const HEIGHT = 600;

  await page.goto("http://localhost:1234");
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  while (true) {
    await page.mouse.click(WIDTH * Math.random(), HEIGHT * Math.random(), {
      button: "left"
    });
  }

  await browser.close();
})();
