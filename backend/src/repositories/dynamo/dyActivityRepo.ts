import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ddb, TABLE_NAME } from './client';
import { keys } from './keys';
import type { ActivityEvent, ActivityEventType } from '../../../../shared/types';
import type { IActivityRepository } from '../types';

interface ActivityItem {
  PK: string;
  SK: string;
  type: 'ACTIVITY';
  id: string;
  trip_id: string;
  member_id?: string;
  member_name?: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function itemToEvent(item: ActivityItem): ActivityEvent {
  return {
    id: item.id,
    trip_id: item.trip_id,
    member_id: item.member_id,
    member_name: item.member_name,
    event_type: item.event_type as ActivityEventType,
    metadata: item.metadata,
    created_at: item.created_at,
  };
}

/**
 * Internal helper used by other dynamo repos that need to log activity.
 */
export async function dyLogActivity(
  tripId: string,
  eventType: ActivityEventType,
  metadata: Record<string, unknown>,
  memberId: string | undefined
): Promise<void> {
  const now = new Date().toISOString();
  const eventId = uuidv4();
  const item: ActivityItem = {
    ...keys.activity(tripId, now, eventId),
    type: 'ACTIVITY',
    id: eventId,
    trip_id: tripId,
    member_id: memberId,
    event_type: eventType,
    metadata,
    created_at: now,
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

export class DyActivityRepository implements IActivityRepository {
  async log(
    tripId: string,
    eventType: ActivityEventType,
    metadata: Record<string, unknown>,
    memberId?: string
  ): Promise<void> {
    return dyLogActivity(tripId, eventType, metadata, memberId);
  }

  async list(
    tripId: string,
    cursor?: string,
    limit = 50
  ): Promise<{ events: ActivityEvent[]; nextCursor?: string }> {
    const { PK, SKPrefix } = keys.prefixes.activity(tripId);

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': PK,
          ':prefix': SKPrefix,
          ...(cursor ? { ':cursor': cursor } : {}),
        },
        ...(cursor
          ? { FilterExpression: 'SK < :cursor' }
          : {}),
        ScanIndexForward: false, // newest first
        Limit: limit + 1,
      })
    );

    const items = (result.Items ?? []) as ActivityItem[];
    const hasMore = items.length > limit;
    const events = items.slice(0, limit).map(itemToEvent);

    return {
      events,
      nextCursor: hasMore ? items[events.length - 1]?.SK : undefined,
    };
  }
}
