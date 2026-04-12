/**
 * Repository factory — switches between Postgres and DynamoDB based on DB_BACKEND env var.
 *
 *   DB_BACKEND=postgres  (default) → Aurora / local Postgres
 *   DB_BACKEND=dynamodb            → DynamoDB / local DynamoDB
 */

import {
  tripRepo,
  memberRepo,
  expenseRepo,
  activityRepo
} from './dynamo'

export { tripRepo, memberRepo, expenseRepo, activityRepo };
