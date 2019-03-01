import "./pre";

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  BrowserRouter,
  Switch,
  Route,
  Link,
  RouteComponentProps
} from "react-router-dom";
import { GPGPUPlayground } from "./GLPlayground";

const range = (n: number) => [...new Array(n).keys()];

const HEADER_LINKS: { name: string; path: string }[] = [
  {
    name: "Index",
    path: "/"
  },
  {
    name: "gl",
    path: "/gl"
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
  // useEffect(() => {
  //   console.log("header");
  //   if (Math.random() < 0.3) {
  //     throw new Error(`Header throw async error 5%`);
  //   }
  // }, []);
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
          <div>
            <input type="text" defaultValue="aaa" />
          </div>
          <div>
            <input type="text" />
          </div>
          <div>
            <textarea />
          </div>
          <div>
            <input type="number" defaultValue="0" />
          </div>
          <div>
            a: <input type="radio" />
            b: <input type="radio" />
            c: <input type="radio" />
            d: <input type="radio" />
          </div>
          <div>
            <select>
              <option value="a">a</option>
              <option value="b">b</option>
              <option value="c">c</option>
            </select>
          </div>

          <hr />
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
  console.log("show-item", id);
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
          <Route exact path="/gl" component={GPGPUPlayground} />
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
