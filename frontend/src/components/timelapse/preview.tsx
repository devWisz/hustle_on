"use client";

import { useEffect, useRef, useState } from "react";
import { ThumbArtwork } from "./thumb";

export function CardPreview({
  seed,
  title,
  creator,
  thumbnailUrl,
  playbackUrl,
}: {
  seed: string;
  title: string;
  creator: string;
  thumbnailUrl?: string;
  playbackUrl?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const [canPreview, setCanPreview] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setCanPreview(
      window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches,
    );
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovering) {
      v.play().catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [hovering, armed]);

  const enabled = canPreview && Boolean(playbackUrl) && !broken;

  return (
    <div
      className="relative h-full w-full"
      onPointerEnter={() => {
        if (!enabled) return;
        setArmed(true);
        setHovering(true);
      }}
      onPointerLeave={() => setHovering(false)}
    >
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-[1.03]"
        />
      ) : (
        <div className="h-full w-full transition-transform duration-700 group-hover:scale-[1.03]">
          <ThumbArtwork seed={seed} title={title} creator={creator} />
        </div>
      )}

      {enabled && armed ? (
        <video
          ref={videoRef}
          src={playbackUrl}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          style={{ opacity: playing && hovering ? 1 : 0 }}
        />
      ) : null}
    </div>
  );
}
