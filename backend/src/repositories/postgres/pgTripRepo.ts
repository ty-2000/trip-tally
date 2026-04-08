import { queryOne, withTransaction } from '../../db/client';
import { pgLogActivity } from './pgActivityRepo';
import type { Trip, CreateTripRequest, UpdateTripRequest } from '../../../../shared/types';
import type { ITripRepository } from '../types';

interface TripRow {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

function rowToTrip(row: TripRow): Trip {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    currency: row.currency,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class PgTripRepository implements ITripRepository {
  async findById(tripId: string): Promise<Trip | null> {
    const row = await queryOne<TripRow>(`SELECT * FROM trips WHERE id = $1`, [tripId]);
    return row ? rowToTrip(row) : null;
  }

  async create(data: CreateTripRequest): Promise<Trip> {
    return withTransaction(async (client) => {
      const result = await client.query<TripRow>(
        `INSERT INTO trips (name, description, currency)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [data.name.trim(), data.description?.trim() ?? null, data.currency.toUpperCase()]
      );
      const trip = rowToTrip(result.rows[0]);
      await pgLogActivity(trip.id, 'TRIP_CREATED', { name: trip.name }, undefined, client);
      return trip;
    });
  }

  async update(tripId: string, data: UpdateTripRequest): Promise<Trip | null> {
    const row = await queryOne<TripRow>(
      `UPDATE trips
       SET name        = COALESCE($2, name),
           description = COALESCE($3, description)
       WHERE id = $1
       RETURNING *`,
      [tripId, data.name?.trim() ?? null, data.description?.trim() ?? null]
    );
    return row ? rowToTrip(row) : null;
  }

  async getTripCurrency(tripId: string): Promise<string | null> {
    const row = await queryOne<{ currency: string }>(
      `SELECT currency FROM trips WHERE id = $1`,
      [tripId]
    );
    return row?.currency ?? null;
  }
}
