import { tripRepo, memberRepo, expenseRepo } from '../repositories/postgres';
import { calculateBalances } from './balanceService';
import { NotFoundError } from '../utils/response';
import type {
  Trip,
  CreateTripRequest,
  UpdateTripRequest,
  TripSummaryResponse,
} from '../../../shared/types';

export async function createTrip(data: CreateTripRequest): Promise<Trip> {
  return tripRepo.create(data);
}

export async function getTrip(tripId: string): Promise<Trip> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  return trip;
}

export async function updateTrip(tripId: string, data: UpdateTripRequest): Promise<Trip> {
  const trip = await tripRepo.update(tripId, data);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  return trip;
}

export async function getTripSummary(tripId: string): Promise<TripSummaryResponse> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);

  const [members, expenses, expensesForBalance] = await Promise.all([
    memberRepo.findByTrip(tripId),
    expenseRepo.findByTrip(tripId),
    expenseRepo.findForBalance(tripId),
  ]);

  const { balances, settlements } = calculateBalances(members, expensesForBalance);

  return { trip, members, expenses, balances, settlements };
}
