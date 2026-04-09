import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ddb, TABLE_NAME } from './client';
import { keys } from './keys';
import { dyLogActivity } from './dyActivityRepo';
import type { Trip, CreateTripRequest, UpdateTripRequest } from '../../../../shared/types';
import type { ITripRepository } from '../types';

interface TripItem {
  PK: string;
  SK: string;
  type: 'TRIP';
  id: string;
  name: string;
  description?: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

function itemToTrip(item: TripItem): Trip {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    currency: item.currency,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export class DyTripRepository implements ITripRepository {
  async findById(tripId: string): Promise<Trip | null> {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: keys.tripMeta(tripId) })
    );
    if (!result.Item) return null;
    return itemToTrip(result.Item as TripItem);
  }

  async create(data: CreateTripRequest): Promise<Trip> {
    const now = new Date().toISOString();
    const tripId = uuidv4();
    const item: TripItem = {
      ...keys.tripMeta(tripId),
      type: 'TRIP',
      id: tripId,
      name: data.name.trim(),
      description: data.description?.trim(),
      currency: data.currency.toUpperCase(),
      created_at: now,
      updated_at: now,
    };
    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    const trip = itemToTrip(item);
    await dyLogActivity(tripId, 'TRIP_CREATED', { name: trip.name }, undefined);
    return trip;
  }

  async update(tripId: string, data: UpdateTripRequest): Promise<Trip | null> {
    const now = new Date().toISOString();
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: keys.tripMeta(tripId),
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'SET #name = if_not_exists(#name, :name), description = if_not_exists(description, :desc), updated_at = :now',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: {
          ':name': data.name?.trim() ?? null,
          ':desc': data.description?.trim() ?? null,
          ':now': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );
    if (!result.Attributes) return null;
    return itemToTrip(result.Attributes as TripItem);
  }

  async getTripCurrency(tripId: string): Promise<string | null> {
    const trip = await this.findById(tripId);
    return trip?.currency ?? null;
  }
}
