import { query, queryOne, withTransaction } from '../../db/client';
import { pgLogActivity } from './pgActivityRepo';
import type { Member } from '../../../../shared/types';
import type { IMemberRepository } from '../types';

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

export class PgMemberRepository implements IMemberRepository {
  async findById(tripId: string, memberId: string): Promise<Member | null> {
    const row = await queryOne<MemberRow>(
      `SELECT * FROM members WHERE id = $1 AND trip_id = $2`,
      [memberId, tripId]
    );
    return row ? rowToMember(row) : null;
  }

  async findByTrip(tripId: string): Promise<Member[]> {
    const rows = await query<MemberRow>(
      `SELECT * FROM members WHERE trip_id = $1 ORDER BY created_at`,
      [tripId]
    );
    return rows.map(rowToMember);
  }

  async create(tripId: string, name: string): Promise<Member> {
    return withTransaction(async (client) => {
      const result = await client.query<MemberRow>(
        `INSERT INTO members (trip_id, name) VALUES ($1, $2) RETURNING *`,
        [tripId, name.trim()]
      );
      const member = rowToMember(result.rows[0]);
      await pgLogActivity(tripId, 'MEMBER_JOINED', { member_name: member.name }, member.id, client);
      return member;
    });
  }

  async remove(tripId: string, memberId: string): Promise<Member | null> {
    return withTransaction(async (client) => {
      const result = await client.query<MemberRow>(
        `DELETE FROM members WHERE id = $1 AND trip_id = $2 RETURNING *`,
        [memberId, tripId]
      );
      if (result.rowCount === 0) return null;
      const member = rowToMember(result.rows[0]);
      await pgLogActivity(tripId, 'MEMBER_REMOVED', { member_name: member.name }, undefined, client);
      return member;
    });
  }

  async hasSplits(tripId: string, memberId: string): Promise<boolean> {
    const [row] = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM expense_splits s
       JOIN expenses e ON e.id = s.expense_id
       WHERE e.trip_id = $1 AND s.member_id = $2`,
      [tripId, memberId]
    );
    return parseInt(row?.count ?? '0', 10) > 0;
  }

  async hasPaidExpenses(tripId: string, memberId: string): Promise<boolean> {
    const [row] = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM expenses
       WHERE trip_id = $1 AND paid_by_member_id = $2`,
      [tripId, memberId]
    );
    return parseInt(row?.count ?? '0', 10) > 0;
  }
}
