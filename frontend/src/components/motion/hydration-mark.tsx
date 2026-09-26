"use client";

import { useEffect } from "react";

export function HydrationMark() {
  useEffect(() => {
    document.documentElement.setAttribute("data-hydrated", "");
  }, []);
  return null;
}
