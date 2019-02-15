import "./pre";

import React, { useState } from "react";
import ReactDOM from "react-dom";
import {
  BrowserRouter,
  Switch,
  Route,
  Link,
  RouteComponentProps
} from "react-router-dom";

const range = (n: number) => [...new Array(n).keys()];

const HEADER_LINKS: { name: string; path: string }[] = [
  {
    name: "Index",
    path: "/"
  },
  {
    name: "About",
    path: "/about"
  },
  {
    name: "Items",
    path: "/items"
  },
  {
    name: "Counter",
    path: "/counter"
  },
  {
    name: "Form",
    path: "/form"
  }
];

const ITEMS: { id: string; title: string; body: string }[] = range(100).map(
  i => {
    return {
      id: i.toString(),
      title: `Item(${i})`,
      body: `Item:body(${i})`
    };
  }
);

function Header() {
  return (
    <header>
      {HEADER_LINKS.map(link => {
        return (
          <span key={link.path}>
            <Link to={link.path}>{link.name}</Link>
            |&nbsp;
          </span>
        );
      })}
    </header>
  );
}

function Index() {
  return <div>index</div>;
}

function About() {
  return <div>about</div>;
}

function Form() {
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: any) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div>
      {submitted ? (
        <div>done</div>
      ) : (
        <form action="/" method="get" onSubmit={onSubmit}>
          <input type="text" defaultValue="aaa" />
          <input type="text" />
          <input type="number" defaultValue="0" />
          <input type="submit" />
        </form>
      )}
    </div>
  );
}

function ItemList() {
  return (
    <div>
      <h1>Items</h1>
      {ITEMS.map(i => {
        return (
          <div key={i.id}>
            <Link to={`/item/${i.id}`}>{i.title}</Link>
          </div>
        );
      })}
    </div>
  );
}

function Counter() {
  const [value, setValue] = useState(0);
  return (
    <div>
      <h2>Counter</h2>
      <button
        onClick={() => {
          setValue(value + 1);
        }}
      >
        +1
      </button>
      <button
        onClick={() => {
          setValue(value - 1);
        }}
      >
        -1
      </button>

      <div>value: {value}</div>
    </div>
  );
}

// -- /item/:id
function Item(props: RouteComponentProps<{ id: string }>) {
  const id = props.match.params.id;
  const item = ITEMS.find(item => {
    return item.id === id;
  });
  if (item) {
    return (
      <div>
        <h2>Title: {item.title}</h2>
        <div>{item.body}</div>
      </div>
    );
  } else {
    return <div>Item:{id} not found</div>;
  }
}

function App() {
  return (
    <BrowserRouter>
      <>
        <Header />
        <Switch>
          <Route exact path="/" component={Index} />
          <Route exact path="/about" component={About} />
          <Route exact path="/items" component={ItemList} />
          <Route exact path="/counter" component={Counter} />
          <Route exact path="/form" component={Form} />
          <Route exact path="/item/:id" component={Item} />
        </Switch>
      </>
    </BrowserRouter>
  );
}

ReactDOM.render(<App />, document.querySelector(".root"));

function pathsToSelector(paths: number[], root = "body") {
  return paths.reduce(
    (expr, next) => `${expr} > *:nth-child(${next + 1})`,
    root
  );
}

// function walk() {
//   const ret: [string, object, number[]][] = [];
//   function _walk(node: HTMLElement, paths: number[]) {
//     const attrs = Array.from(node.attributes).reduce(
//       (acc, attr) => ({ ...acc, [attr.nodeName]: attr.value }),
//       {}
//     );

//     ret.push([node.tagName.toLowerCase(), attrs, paths]);

//     if (node.childNodes && node.childNodes.length > 0) {
//       Array.from(node.childNodes)
//         // Drop Text Node
//         .filter(n => n instanceof HTMLElement)
//         .map((child, index) => {
//           _walk(child as HTMLElement, paths.concat([index]));
//         });
//     }
//   }

//   _walk(document.body, []);
//   ret.forEach(([tag, attrs, paths]) => {
//     const selector = pathsToSelector(paths);
//     console.log(tag, paths, attrs, document.querySelector(selector));
//   });
// }

// setTimeout(() => {
//   // console.log("walk");
//   walk();
// }, 1000);
