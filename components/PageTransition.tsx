"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/*
  Page transitions, carried by the mark.

  The shield is the one thing every route has in common: big and centred on the
  front door, small and top-left on every page behind it. Giving both the same
  `view-transition-name` makes the browser treat them as the same object, so
  navigating morphs the mark from one position to the other instead of cutting
  between two unrelated screens. The rest of the page cross-fades under it.

  This drives the browser's View Transitions API directly rather than React's
  <ViewTransition>, which only exists in the React canary that Next 16 bundles.
  Where the API is missing (Firefox, older Safari) the click falls through to a
  plain navigation — no curtain, no polyfill, nothing to go wrong.

  The names themselves live in globals.css on .home-mark, .doc-brand .logo-wrap
  and .brand .logo-wrap. Only one of those renders per route, which matters:
  two visible elements sharing a view-transition-name aborts the transition.
*/

/** if a route never arrives, let the snapshot go rather than freezing the page */
const BAIL_MS = 1200;

type Doc = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
};

export default function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  // resolves the view transition's callback once the new route has committed
  const arrive = useRef<(() => void) | null>(null);

  const settle = () => {
    arrive.current?.();
    arrive.current = null;
  };

  // The new snapshot is taken when this resolves, so it has to wait for the
  // route to actually render — router.push gives us no promise to await.
  useEffect(settle, [pathname]);
  useEffect(() => settle, []);

  const reduced = useCallback(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  /*
    One delegated listener rather than a wrapper around every Link: the site
    has anchors in prose, in cards and in the HUD, and they should all behave
    the same without each one having to opt in.

    It listens in the CAPTURE phase, which is not a detail. next/link handles
    the click on the anchor itself and calls preventDefault, so a bubble-phase
    listener on the document runs afterwards and sees defaultPrevented — the
    transition never fired at all. Capturing at the document gets there first;
    stopPropagation then keeps Link from navigating a second time.
  */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      // let the browser handle open-in-new-tab and friends
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.hasAttribute("download")) return;
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;

      const href = a.getAttribute("href");
      // internal routes only — external links, mailto: and #anchors pass through
      if (!href || !href.startsWith("/")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // an anchor on the page you are already on is a scroll, not a navigation
      if (url.pathname === window.location.pathname) return;

      const to = url.pathname + url.search + url.hash;
      const doc = document as Doc;

      if (!doc.startViewTransition || reduced()) return; // plain navigation

      e.preventDefault();
      e.stopPropagation();
      doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            arrive.current = resolve;
            router.push(to);
            window.setTimeout(settle, BAIL_MS);
          })
      );
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router, reduced]);

  return null;
}
