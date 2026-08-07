import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Compare from "./pages/Compare";
import Home from "./pages/Home";
import HumanAnalysis from "./pages/HumanAnalysis";
import NotFound from "./pages/NotFound";
import Results from "./pages/Results";
import SpeciesAnalysis from "./pages/SpeciesAnalysis";
import FAQ from "./pages/FAQ";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/human" component={HumanAnalysis} />
      <Route path="/species" component={SpeciesAnalysis} />
      <Route path="/compare" component={Compare} />
      <Route path="/results/:jobId" component={Results} />
      <Route path="/faq" component={FAQ} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}


function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
