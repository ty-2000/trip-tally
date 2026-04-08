import { activityRepo } from '../repositories/postgres';
import type { ActivityEvent } from '../../../shared/types';

export async function getActivity(
  tripId: string,
  cursor?: string,
  limit?: number
): Promise<{ events: ActivityEvent[]; nextCursor?: string }> {
  return activityRepo.list(tripId, cursor, limit);
}
