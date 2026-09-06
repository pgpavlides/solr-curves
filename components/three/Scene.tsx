"use client";

import dynamic from "next/dynamic";

/*
  WebGL cannot render during a static export, so every scene is pulled in
  client-side only. This wrapper is a client component, which is what makes
  `ssr: false` legal in the App Router.
*/
function Loading({ height }: { height: number }) {
  return (
    <div className="viewport">
      <div
        className="viewport-fallback"
        style={{ height: height + 1 }}
        role="status"
      >
        loading scene…
      </div>
    </div>
  );
}

const scenes = {
  hero: dynamic(() => import("./scenes/HeroScene"), {
    ssr: false,
    loading: () => <Loading height={430} />,
  }),
  lift: dynamic(() => import("./scenes/LiftVectorScene"), {
    ssr: false,
    loading: () => <Loading height={490} />,
  }),
  jhook: dynamic(() => import("./scenes/JHookScene"), {
    ssr: false,
    loading: () => <Loading height={490} />,
  }),
  drop: dynamic(() => import("./scenes/DropScene"), {
    ssr: false,
    loading: () => <Loading height={490} />,
  }),
};

export type SceneName = keyof typeof scenes;

export default function Scene({ name }: { name: SceneName }) {
  const S = scenes[name];
  return <S />;
}
