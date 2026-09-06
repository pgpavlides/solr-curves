"use client";

import { useState } from "react";

/*
  YouTube thumbnail with a fallback.

  `maxresdefault` is the 1280x720 frame but it does not exist for every video,
  so a 404 falls back to `hqdefault`, which always does. hqdefault is 480x360
  with the 16:9 frame letterboxed inside it — cropping the container to 16:9
  with object-fit: cover removes those bars exactly, so both sources land on
  the same framing and no layout shift is possible.
*/
export default function YouTubeThumb({
  videoId,
  alt,
  duration,
  eager = false,
}: {
  videoId: string;
  alt: string;
  duration?: string;
  eager?: boolean;
}) {
  const [src, setSrc] = useState(
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
  );

  return (
    <span className="thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={1280}
        height={720}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setSrc(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)}
      />
      <span className="thumb-play" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      {duration && <span className="thumb-time">{duration}</span>}
    </span>
  );
}
