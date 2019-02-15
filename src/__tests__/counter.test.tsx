import React from "react";
import { createStore, Store } from "redux";
import { Provider, connect } from "react-redux";
import { render, fireEvent, cleanup } from "react-testing-library";

// implements

type State = { count: number };

function reducer(state = { count: 0 }, action: any) {
  switch (action.type) {
    case "INCREMENT": {
      return {
        count: state.count + 1
      };
    }
    case "DECREMENT": {
      return {
        count: state.count - 1
      };
    }
    default:
      return state;
  }
}

const mapStateToProps = (state: State) => ({ count: state.count });

const Counter = connect(mapStateToProps)(function Counter(props: {
  count: number;
  dispatch: Function;
}) {
  return (
    <div>
      <h2>Counter</h2>
      <div>
        <button
          onClick={() => {
            props.dispatch({ type: "DECREMENT" });
          }}
        >
          -
        </button>
        <span data-testid="count-value">{props.count}</span>
        <button
          onClick={() => {
            props.dispatch({ type: "INCREMENT" });
          }}
        >
          +
        </button>
      </div>
    </div>
  );
});

// test

afterEach(cleanup);

test("click +, then count-value is 1", () => {
  const store: Store<State> = createStore(reducer);
  const result = render(
    <Provider store={store}>
      <Counter />
    </Provider>
  );
  fireEvent.click(result.getByText("+"));
  expect(result.getByTestId("count-value").textContent).toBe("1");
});

test("click -, then count-value is -1", () => {
  const store: Store<State> = createStore(reducer);
  const result = render(
    <Provider store={store}>
      <Counter />
    </Provider>
  );
  fireEvent.click(result.getByText("+"));
  expect(result.getByTestId("count-value").textContent).toBe("-1");
});
