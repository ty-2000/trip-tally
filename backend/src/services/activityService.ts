import { activityRepo, memberRepo } from '../repositories';
import type { ActivityEvent } from '../../../shared/types';

export async function getActivity(
  tripId: string,
  cursor?: string,
  limit?: number
): Promise<{ events: ActivityEvent[]; nextCursor?: string }> {
  const result = await activityRepo.list(tripId, cursor, limit);

  const members = await memberRepo.findByTrip(tripId);
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  return {
    ...result,
    events: result.events.map((e) =>
      !e.member_name && e.member_id
        ? { ...e, member_name: nameById.get(e.member_id) }
        : e
    ),
  };
}
