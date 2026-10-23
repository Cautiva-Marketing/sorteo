import "server-only";
import { cache } from "react";
import { countParticipants as countParticipantsUncached } from "@/services/participants.service";
import { listPrizes as listPrizesUncached } from "@/services/prizes.service";
import {
  listWheelParticipants as listWheelParticipantsUncached,
  listWinnerRecords as listWinnerRecordsUncached,
} from "@/services/spins.service";

/**
 * Lecturas del panel memorizadas por petición: el layout y la página piden los mismos datos
 * (premios, ganadores, conteo) y así Firestore se consulta una sola vez por render.
 */
export const countParticipants = cache(countParticipantsUncached);
export const listPrizes = cache(listPrizesUncached);
export const listWheelParticipants = cache(listWheelParticipantsUncached);
export const listWinnerRecords = cache(listWinnerRecordsUncached);
