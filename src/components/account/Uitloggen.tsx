"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Uitloggen() {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);

  return (
    <button
      type="button"
      disabled={bezig}
      onClick={async () => {
        setBezig(true);
        await fetch("/api/account/uitloggen", { method: "POST" }).catch(() => undefined);
        router.refresh();
      }}
      className="rounded-lg border-2 border-ink/10 px-4 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
    >
      {bezig ? "Bezig…" : "Uitloggen"}
    </button>
  );
}
