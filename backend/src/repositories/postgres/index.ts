import { PgTripRepository } from './pgTripRepo';
import { PgMemberRepository } from './pgMemberRepo';
import { PgExpenseRepository } from './pgExpenseRepo';
import { PgActivityRepository } from './pgActivityRepo';

export const tripRepo = new PgTripRepository();
export const memberRepo = new PgMemberRepository();
export const expenseRepo = new PgExpenseRepository();
export const activityRepo = new PgActivityRepository();
