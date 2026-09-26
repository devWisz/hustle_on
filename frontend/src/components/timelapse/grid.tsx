import type { Timelapse } from "@/lib/types";
import { cx } from "@/lib/format";
import { Reveal } from "../motion/reveal";
import { TimelapseCard } from "./card";

export function TimelapseGrid({
  items,
  demo = false,
  className,
}: {
  items: Timelapse[];
  demo?: boolean;
  className?: string;
}) {
  return (
    <Reveal
      stagger={0.08}
      className={cx("grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {items.map((t) => (
        <TimelapseCard key={t.id} timelapse={t} demo={demo} />
      ))}
    </Reveal>
  );
}
