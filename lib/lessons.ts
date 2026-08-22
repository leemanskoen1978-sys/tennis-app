// Wie ziet welk lesmateriaal.
//
// Deze regel stond in het lesmateriaalscherm zelf; sinds er een hub, een formulier en een
// databank zijn, hebben twee schermen hem nodig. Hier staat hij één keer, zodat een speler
// niet op het ene scherm meer te zien krijgt dan op het andere.

import type { Lesson, User } from './types';
import { isCoach } from './rechten';

/**
 * Een trainer ziet de hele databank. Een speler ziet alleen wat aan hém is toegewezen.
 *
 * Materiaal zonder speler (`student_id` leeg) is het clubmateriaal: de 51 trainingen uit het
 * boekje, de veldsituaties die een trainer voor zichzelf bewaart. Dat is het gereedschap van
 * de trainer en niet het huiswerk van de speler — een speler die de hele databank kan
 * doorbladeren, ziet vooral honderden oefeningen die niet over hem gaan.
 *
 * Wil een trainer dat een speler een oefening ziet, dan wijst hij die aan hem toe. Dat is
 * dezelfde handeling als altijd ("Voor wie" op het lesmateriaal), en nu ook de enige.
 *
 * Zonder ingelogde gebruiker blijft er niets over: dat is de veilige kant van de vergissing.
 */
export function visibleLessonsFor(lessons: Lesson[], user: User | null | undefined): Lesson[] {
  if (!user) return [];
  if (isCoach(user)) return lessons;
  return lessons.filter((l) => l.student_id === user.id);
}
