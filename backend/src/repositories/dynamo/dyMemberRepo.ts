import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ddb, TABLE_NAME } from './client';
import { keys } from './keys';
import { dyLogActivity } from './dyActivityRepo';
import { ConflictError } from '../../utils/response';
import type { Member } from '../../../../shared/types';
import type { IMemberRepository } from '../types';

interface MemberItem {
  PK: string;
  SK: string;
  type: 'MEMBER';
  id: string;
  trip_id: string;
  name: string;
  name_lower: string; // for uniqueness check
  created_at: string;
}

function itemToMember(item: MemberItem): Member {
  return {
    id: item.id,
    trip_id: item.trip_id,
    name: item.name,
    created_at: item.created_at,
  };
}

export class DyMemberRepository implements IMemberRepository {
  async findById(tripId: string, memberId: string): Promise<Member | null> {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: keys.member(tripId, memberId) })
    );
    if (!result.Item) return null;
    return itemToMember(result.Item as MemberItem);
  }

  async findByTrip(tripId: string): Promise<Member[]> {
    const { PK, SKPrefix } = keys.prefixes.members(tripId);
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': PK, ':prefix': SKPrefix },
        ScanIndexForward: true,
      })
    );
    return (result.Items ?? []).map((i) => itemToMember(i as MemberItem));
  }

  async create(tripId: string, name: string): Promise<Member> {
    // Check name uniqueness (case-insensitive)
    const existing = await this.findByTrip(tripId);
    if (existing.some((m) => m.name.toLowerCase() === name.trim().toLowerCase())) {
      throw new ConflictError(`Member "${name}" already exists in this trip`);
    }

    const now = new Date().toISOString();
    const memberId = uuidv4();
    const item: MemberItem = {
      ...keys.member(tripId, memberId),
      type: 'MEMBER',
      id: memberId,
      trip_id: tripId,
      name: name.trim(),
      name_lower: name.trim().toLowerCase(),
      created_at: now,
    };
    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    const member = itemToMember(item);
    await dyLogActivity(tripId, 'MEMBER_JOINED', { member_name: member.name }, member.id);
    return member;
  }

  async remove(tripId: string, memberId: string): Promise<Member | null> {
    const existing = await this.findById(tripId, memberId);
    if (!existing) return null;
    await ddb.send(
      new DeleteCommand({ TableName: TABLE_NAME, Key: keys.member(tripId, memberId) })
    );
    await dyLogActivity(tripId, 'MEMBER_REMOVED', { member_name: existing.name }, undefined);
    return existing;
  }

  async hasSplits(tripId: string, memberId: string): Promise<boolean> {
    // Query all splits in the trip and check if any reference this member
    const { PK } = keys.prefixes.activity(tripId);
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'member_id = :mid',
        ExpressionAttributeValues: {
          ':pk': `TRIP#${tripId}`,
          ':prefix': 'SPLIT#',
          ':mid': memberId,
        },
        Limit: 1,
      })
    );
    return (result.Count ?? 0) > 0;
  }

  async hasPaidExpenses(tripId: string, memberId: string): Promise<boolean> {
    const { PK, SKPrefix } = keys.prefixes.expenses(tripId);
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'paid_by_member_id = :mid',
        ExpressionAttributeValues: { ':pk': PK, ':prefix': SKPrefix, ':mid': memberId },
        Limit: 1,
      })
    );
    return (result.Count ?? 0) > 0;
  }
}
