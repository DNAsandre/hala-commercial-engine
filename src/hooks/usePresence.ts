/**
 * usePresence.ts
 * ──────────────
 * FPS-007-09 — Lightweight multi-user presence via Supabase Realtime.
 *
 * Shows who else is on the same document. FULLY non-blocking: if Realtime is
 * unavailable it simply reports no one. Presence NEVER locks the editor or
 * blocks export — it is advisory only.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PresentUser {
  key: string;
  name: string;
  at: string;
}

export function usePresence(
  instanceId: string | null,
  me: { id: string; name: string },
): PresentUser[] {
  const [others, setOthers] = useState<PresentUser[]>([]);

  useEffect(() => {
    if (!instanceId) { setOthers([]); return; }
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`fps:instance:${instanceId}`, {
        config: { presence: { key: me.id } },
      });
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState() as Record<string, Array<Record<string, unknown>>>;
          const list: PresentUser[] = [];
          for (const [key, metas] of Object.entries(state)) {
            if (key === me.id) continue; // exclude self
            const m = metas[0] || {};
            list.push({ key, name: (m.name as string) || key, at: (m.at as string) || "" });
          }
          setOthers(list);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            try { await channel!.track({ name: me.name, at: new Date().toISOString() }); } catch { /* non-fatal */ }
          }
        });
    } catch {
      setOthers([]);
    }
    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* non-fatal */ }
      }
    };
  }, [instanceId, me.id, me.name]);

  return others;
}
