import type { AcademicContentEntry } from '../types/academicContent.types';
import { getHonorCategory, sortOfficialDistinctions } from '../../honors/utils/honorRules.ts';

export interface HonorGroup {
  key: string;
  periodId: string;
  category: 'official' | 'institutional';
  people: AcademicContentEntry[];
  year: string;
}

export const HONOR_EMPTY_MESSAGE = 'No hay un período académico vigente ni distinciones registradas para esta institución.';

/** Groups the official distinctions by period; the current period always appears so its slots can be filled. */
export function buildHonorGroups(visibleEntries: readonly AcademicContentEntry[], periods: readonly AcademicContentEntry[], currentPeriod: AcademicContentEntry | undefined): HonorGroup[] {
  const groups = new Map<string, AcademicContentEntry[]>();
  visibleEntries.filter(entry => getHonorCategory(entry) === 'official').forEach(entry => {
    const key = `${entry.periodId || 'no-period'}:${getHonorCategory(entry)}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  const result: HonorGroup[] = [...groups.entries()].map(([key, people]) => {
    const [periodId, category] = key.split(':');
    return {
      key,
      periodId,
      category: category as HonorGroup['category'],
      people: category === 'official' ? sortOfficialDistinctions(people) : people,
      year: periods.find(period => period.id === periodId)?.title ?? 'Año sin período',
    };
  });
  if (currentPeriod && !groups.has(`${currentPeriod.id}:official`)) {
    result.push({ key: `${currentPeriod.id}:official`, periodId: currentPeriod.id, category: 'official', people: [], year: currentPeriod.title });
  }
  return result.sort((a, b) => b.year.localeCompare(a.year) || (a.category === 'official' ? -1 : 1));
}
