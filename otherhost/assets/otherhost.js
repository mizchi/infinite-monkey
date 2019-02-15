console.log("other host message");

function main() {
  throw new Error("other-host-error");
}
main();
