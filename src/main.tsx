import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// No StrictMode: the undo stack is written inside state updaters, and
// StrictMode's double-invoke would record every edit twice.
createRoot(document.getElementById("root")!).render(<App />);
