import React from "react";
import ReactDOM from "react-dom/client";
import { Route, Switch } from "wouter";
import Home from "./pages/Home";
import Analysis from "./pages/Analysis";
import Compare from "./pages/Compare";
import Results from "./pages/Results";
import "./styles.css";

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/human">{() => <Analysis human />}</Route>
      <Route path="/species">{() => <Analysis human={false} />}</Route>
      <Route path="/compare" component={Compare} />
      <Route path="/results/:jobId" component={Results} />
      <Route>{() => <Home />}</Route>
    </Switch>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
