import "./polyfill";
import "abortcontroller-polyfill/dist/abortcontroller-polyfill-only";
import "requestidlecallback-polyfill";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
