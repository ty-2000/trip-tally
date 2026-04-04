import { PoolClient } from 'pg';
import { query } from '../db/client';
import type { ActivityEvent, ActivityEventType } from '../../../shared/types';

interface ActivityRow {
  id: string;
  trip_id: string;
  member_id: string | null;
  member_name: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Log an activity event. Accepts an optional DB client for use inside transactions.
 */
export async function logActivity(
  tripId: string,
  eventType: ActivityEventType,
  metadata: Record<string, unknown>,
  memberId?: string,
  client?: PoolClient
): Promise<void> {
  const sql = `
    INSERT INTO activity_log (trip_id, member_id, event_type, metadata)
    VALUES ($1, $2, $3, $4)
  `;
  const params = [tripId, memberId ?? null, eventType, JSON.stringify(metadata)];

  if (client) {
    await client.query(sql, params);
  } else {
    await query(sql, params);
  }
}

export async function getActivity(
  tripId: string,
  cursor?: string,
  limit = 50
): Promise<{ events: ActivityEvent[]; nextCursor?: string }> {
  const rows = await query<ActivityRow>(
    `SELECT
       a.id,
       a.trip_id,
       a.member_id,
       m.name AS member_name,
       a.event_type,
       a.metadata,
       a.created_at
     FROM activity_log a
     LEFT JOIN members m ON m.id = a.member_id
     WHERE a.trip_id = $1
       AND ($2::uuid IS NULL OR a.created_at < (
         SELECT created_at FROM activity_log WHERE id = $2
       ))
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [tripId, cursor ?? null, limit + 1]
  );

  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit).map((row) => ({
    id: row.id,
    trip_id: row.trip_id,
    member_id: row.member_id ?? undefined,
    member_name: row.member_name ?? undefined,
    event_type: row.event_type as ActivityEventType,
    metadata: row.metadata,
    created_at: row.created_at,
  }));

  return {
    events,
    nextCursor: hasMore ? events[events.length - 1]?.id : undefined,
  };
}
