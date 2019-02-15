import "@babel/polyfill";
import Stacktrace from "stacktrace-js";
import { last } from "lodash";

// window.addEventListener("error", async event => {
//   console.log("error", event);
//   if (event.error) {
//     const traces = await Stacktrace.fromError(event.error);
//     const lastTrace = last(traces);
//     console.log("fired from", lastTrace && lastTrace.fileName);
//   }
// });

// window.addEventListener("unhandledrejection", event => {
//   console.log("unhandled rejection", event);
// });

// if (Math.random() < 0.1) {
//   throw new Error(`custom error ${Date.now()}`);
// }
// throw new Error(`custom error ${Date.now()}`);

// new Promise((res, rej) => {
//   rej("promise-error");
// });

// const script = document.createElement("script");
// script.src = "http://localhost:4000/otherhost.js";
// document.body.append(script);
