import { createRoot } from "react-dom/client";
import App from "./App";
import Overlay from "./Overlay";
import "./styles.css";

// One bundle, two windows: the editor, and the in-game overlay (#overlay),
// which Rust opens as a separate transparent window.
const isOverlay = location.hash === "#overlay";

// No StrictMode: the undo stack is written inside state updaters, and
// StrictMode's double-invoke would record every edit twice.
createRoot(document.getElementById("root")!).render(isOverlay ? <Overlay /> : <App />);
