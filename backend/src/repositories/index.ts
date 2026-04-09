/**
 * Repository factory — switches between Postgres and DynamoDB based on DB_BACKEND env var.
 *
 *   DB_BACKEND=postgres  (default) → Aurora / local Postgres
 *   DB_BACKEND=dynamodb            → DynamoDB / local DynamoDB
 */

import type {
  ITripRepository,
  IMemberRepository,
  IExpenseRepository,
  IActivityRepository,
} from './types';

function loadRepos(): {
  tripRepo: ITripRepository;
  memberRepo: IMemberRepository;
  expenseRepo: IExpenseRepository;
  activityRepo: IActivityRepository;
} {
  if (process.env.DB_BACKEND === 'dynamodb') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./dynamo');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./postgres');
}

const { tripRepo, memberRepo, expenseRepo, activityRepo } = loadRepos();

export { tripRepo, memberRepo, expenseRepo, activityRepo };
