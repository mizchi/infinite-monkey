# infinite-monkey

Random browser controller on puppeteer

![](https://i.gyazo.com/6b9db607f079cf915fd647116818bb09.gif)

Collect error and coverage

```
$ npm install -g @mizchi/infinite-monkey
$ infinite-monkey http://localhost:3000 --interval 300

$ /Users/mz/.ghq/github.com/mizchi/infinite-monkey/node_modules/.bin/ts-node -T src/crawl.ts http://localhost:1234 --interval 32
Terminate(Error): Terminate by error: http://localhost:1234/about: Error: Execution context was destroyed, most likely because of a navigation.

Bytes used: 43.32789809868165%
...
```

## How to use

```
$ infinite-monkey http://localhost:1234 --interval 16 --maxRetry 3 --maxAction 300 --noHeadless
```

## LICENSE

MIT
