import { DyTripRepository } from './dyTripRepo';
import { DyMemberRepository } from './dyMemberRepo';
import { DyExpenseRepository } from './dyExpenseRepo';
import { DyActivityRepository } from './dyActivityRepo';

export const tripRepo = new DyTripRepository();
export const memberRepo = new DyMemberRepository();
export const expenseRepo = new DyExpenseRepository();
export const activityRepo = new DyActivityRepository();
