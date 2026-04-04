import { query, queryOne, withTransaction } from '../db/client';
import { logActivity } from './activityService';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/response';
import type { Member } from '../../../shared/types';

interface MemberRow {
  id: string;
  trip_id: string;
  name: string;
  created_at: string;
}

function rowToMember(row: MemberRow): Member {
  return {
    id: row.id,
    trip_id: row.trip_id,
    name: row.name,
    created_at: row.created_at,
  };
}

export async function addMember(tripId: string, name: string): Promise<Member> {
  // Verify trip exists
  const tripExists = await queryOne(
    `SELECT id FROM trips WHERE id = $1`,
    [tripId]
  );
  if (!tripExists) throw new NotFoundError(`Trip ${tripId} not found`);

  return await withTransaction(async (client) => {
    let row: MemberRow;
    try {
      const result = await client.query<MemberRow>(
        `INSERT INTO members (trip_id, name) VALUES ($1, $2) RETURNING *`,
        [tripId, name.trim()]
      );
      row = result.rows[0];
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code === '23505'
      ) {
        throw new ConflictError(`Member "${name}" already exists in this trip`);
      }
      throw err;
    }

    const member = rowToMember(row);
    await logActivity(tripId, 'MEMBER_JOINED', { member_name: member.name }, member.id, client);
    return member;
  });
}

export async function getMembers(tripId: string): Promise<Member[]> {
  const rows = await query<MemberRow>(
    `SELECT * FROM members WHERE trip_id = $1 ORDER BY created_at`,
    [tripId]
  );
  return rows.map(rowToMember);
}

export async function getMember(tripId: string, memberId: string): Promise<Member> {
  const row = await queryOne<MemberRow>(
    `SELECT * FROM members WHERE id = $1 AND trip_id = $2`,
    [memberId, tripId]
  );
  if (!row) throw new NotFoundError(`Member ${memberId} not found`);
  return rowToMember(row);
}

export async function removeMember(
  tripId: string,
  memberId: string
): Promise<void> {
  // Check for any splits referencing this member
  const [splitCount] = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM expense_splits s
     JOIN expenses e ON e.id = s.expense_id
     WHERE e.trip_id = $1 AND s.member_id = $2`,
    [tripId, memberId]
  );

  if (parseInt(splitCount?.count ?? '0', 10) > 0) {
    throw new BadRequestError(
      'Cannot remove a member who has expense splits. Delete or update the expenses first.'
    );
  }

  const [paidCount] = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM expenses
     WHERE trip_id = $1 AND paid_by_member_id = $2`,
    [tripId, memberId]
  );

  if (parseInt(paidCount?.count ?? '0', 10) > 0) {
    throw new BadRequestError(
      'Cannot remove a member who has paid for expenses. Delete or reassign the expenses first.'
    );
  }

  await withTransaction(async (client) => {
    const result = await client.query<MemberRow>(
      `DELETE FROM members WHERE id = $1 AND trip_id = $2 RETURNING *`,
      [memberId, tripId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundError(`Member ${memberId} not found`);
    }
    const member = result.rows[0];
    await logActivity(
      tripId,
      'MEMBER_REMOVED',
      { member_name: member.name },
      undefined,
      client
    );
  });
}
