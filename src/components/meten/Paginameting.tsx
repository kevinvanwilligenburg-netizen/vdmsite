"use client";

import { useEffect, useRef } from "react";

import {
  volgAfrekenenGestart,
  volgBekekenArtikel,
  type AnalyticsItem,
} from "@/lib/analytics";

/**
 * Twee metingen die aan een pagina hangen in plaats van aan een knop.
 *
 * `view_item` voedt de remarketinglijsten van Google Ads en Meta: zonder deze
 * gebeurtenis weet Google niet welk product iemand heeft bekeken en kan het
 * hem geen advertentie voor dat product tonen. `begin_checkout` is de stap
 * waarop je de uitval in de trechter ziet.
 *
 * De ref houdt het bij één keer per gemonteerde pagina: React draait effects
 * in ontwikkelmodus dubbel, en bij het wisselen van maat of kleur hertekent de
 * productpagina zonder dat er een nieuw artikel wordt bekeken.
 */
export function ArtikelBekeken({ item }: { item: AnalyticsItem }) {
  const gemeld = useRef<string | null>(null);
  useEffect(() => {
    if (gemeld.current === item.item_id) return;
    gemeld.current = item.item_id;
    volgBekekenArtikel(item);
  }, [item]);
  return null;
}

export function AfrekenenGestart({
  items,
  waarde,
}: {
  items: AnalyticsItem[];
  waarde: number;
}) {
  const gemeld = useRef(false);
  useEffect(() => {
    // Een leeg mandje is geen afrekenpoging; die pagina stuurt vanzelf terug.
    if (gemeld.current || items.length === 0) return;
    gemeld.current = true;
    volgAfrekenenGestart(items, waarde);
  }, [items, waarde]);
  return null;
}
