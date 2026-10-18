"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
