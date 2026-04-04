import { Pool, PoolClient } from 'pg';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

interface DbSecret {
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
}

async function resolveCredentials(): Promise<{
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}> {
  const secretArn = process.env.DB_SECRET_ARN;

  if (secretArn) {
    // Running in Lambda — fetch credentials from Secrets Manager
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    const result = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
    const secret: DbSecret = JSON.parse(result.SecretString ?? '{}');
    return {
      host: secret.host,
      port: secret.port ?? 5432,
      database: secret.dbname,
      user: secret.username,
      password: secret.password,
    };
  }

  // Local development — read from env vars
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'triptally',
    user: process.env.DB_USER ?? 'triptally_admin',
    password: process.env.DB_PASSWORD ?? '',
  };
}

// Initialise the pool once per Lambda container (outside handler for connection reuse)
let poolPromise: Promise<Pool> | null = null;

function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = resolveCredentials().then((creds) => {
      const p = new Pool({
        ...creds,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      });
      p.on('error', (err) => {
        console.error('Unexpected DB pool error', err);
        poolPromise = null;
      });
      return p;
    });
  }
  return poolPromise;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const p = await getPool();
  const client = await p.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = await getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
