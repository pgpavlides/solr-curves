"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** /map has no map of its own; Ozeti is the default. */
export default function MapRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/map/ozeti/");
  }, [router]);

  return (
    <div className="wm-redirect">
      <p>
        Opening the <Link href="/map/ozeti/">Ozeti map</Link>…
      </p>
      <p>
        Or go straight to <Link href="/map/bakurani/">Bakurani</Link>.
      </p>
    </div>
  );
}
