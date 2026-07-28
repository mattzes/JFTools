"use client";

import { use } from "react";
import { useApi, Person, Termin, Planung, HindernisFaehigkeit, Verfuegbarkeit } from "@/lib/api";
import { Spinner, Empty } from "@/components/ui";
import { GruppenPlaner } from "@/components/GruppenPlaner";

export default function WettbewerbPlanerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const terminId = Number(id);
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: planung, reload } = useApi<Planung>(`/termine/${terminId}/planung`);
  const { data: hindernisse } = useApi<HindernisFaehigkeit[]>("/hindernis");
  const { data: termine } = useApi<Termin[]>("/termine");
  const { data: alleVerf } = useApi<Verfuegbarkeit[]>("/verfuegbarkeiten");

  if (!personen || !planung || !hindernisse || !termine || !alleVerf) return <Spinner />;
  if (!planung.termin) return <Empty icon="ph-trophy" text="Termin nicht gefunden" />;
  if (planung.termin.planungsmodus === "keine") {
    return <Empty icon="ph-info" text="Dieser Termin hat keinen Planungsmodus" hint="Ändere den Planungsmodus des Termins auf nur_gruppen, a_teil oder a_und_b_teil." />;
  }

  return <GruppenPlaner personen={personen} planung={planung} hindernisse={hindernisse} termine={termine} alleVerf={alleVerf} reload={reload} />;
}
