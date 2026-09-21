import { useEffect, useState } from "react";
import { type MemoryUsage, memoryUsage } from "./bridge";

/* Bottom right: how much RAM the app is using, the same figure Task Manager shows. */

const mb = (b: number) => `${Math.round(b / 1048576)} MB`;

export default function RamBadge() {
  const [use, setUse] = useState<MemoryUsage | null>(null);
  useEffect(() => {
    const read = () => memoryUsage().then(setUse).catch(() => {});
    read();
    const t = setInterval(read, 3000);
    return () => clearInterval(t);
  }, []);
  if (!use) return null;
  return (
    <div className="ram" title={`App ${mb(use.app)} · window (WebView2) ${mb(use.webview)} · ${use.processes} processes`}>
      RAM <b>{mb(use.total)}</b>
    </div>
  );
}
