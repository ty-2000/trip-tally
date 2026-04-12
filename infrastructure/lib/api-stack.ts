import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  receiptsBucket: s3.Bucket;
  frontendUrl?: string;
  /**
   * DynamoDB table — always pass so the migration Lambda can write to it.
   * Set usesDynamoBackend=true to also switch all Lambdas to DB_BACKEND=dynamodb.
   */
  dynamoTable?: dynamodb.ITable;
  /** When true, all Lambdas run with DB_BACKEND=dynamodb. Defaults to false. */
  usesDynamoBackend?: boolean;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      vpc,
      receiptsBucket,
      frontendUrl = '*',
      dynamoTable,
    } = props;

    // Shared environment variables for all Lambda functions
    const commonEnv: Record<string, string> = {
      RECEIPTS_BUCKET: receiptsBucket.bucketName,
      FRONTEND_URL: frontendUrl,
      DYNAMODB_TABLE: dynamoTable!.tableName,
    };

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc,
      description: 'Lambda functions - allows outbound to RDS',
    });

    // Helper to create a NodejsFunction
    const createFn = (
      name: string,
      entry: string,
      handler: string
    ): lambdaNodejs.NodejsFunction => {
      const fn = new lambdaNodejs.NodejsFunction(this, name, {
        functionName: `trip-tally-${name}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        // entry is relative to repo root so Docker mounts the whole monorepo
        entry: path.join(__dirname, '../../backend/src/functions', entry),
        // projectRoot tells CDK (and Docker) the root to mount — must contain
        // the entry file and the package-lock.json used for bundling
        projectRoot: path.join(__dirname, '../..'),
        depsLockFilePath: path.join(__dirname, '../../backend/package-lock.json'),
        handler,
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        securityGroups: [lambdaSecurityGroup],
        environment: commonEnv,
        timeout: cdk.Duration.seconds(15),
        memorySize: 256,
        bundling: {
          minify: true,
          sourceMap: false,
          target: 'es2022',
          externalModules: ['pg-native'],
        },
      });

      return fn;
    };

    // Lambda functions (grouped by resource)
    const tripsCreateFn  = createFn('trips-create',  'trips.ts', 'create');
    const tripsGetFn     = createFn('trips-get',     'trips.ts', 'get');
    const tripsUpdateFn  = createFn('trips-update',  'trips.ts', 'update');

    const membersCreateFn = createFn('members-create', 'members.ts', 'create');
    const membersListFn   = createFn('members-list',   'members.ts', 'list');
    const membersRemoveFn = createFn('members-remove', 'members.ts', 'remove');

    const expensesCreateFn = createFn('expenses-create', 'expenses.ts', 'create');
    const expensesListFn   = createFn('expenses-list',   'expenses.ts', 'list');
    const expensesGetFn    = createFn('expenses-get',    'expenses.ts', 'get');
    const expensesUpdateFn = createFn('expenses-update', 'expenses.ts', 'update');
    const expensesRemoveFn = createFn('expenses-remove', 'expenses.ts', 'remove');

    const uploadsUrlFn      = createFn('uploads-url',     'uploads.ts', 'getUploadUrl');
    const uploadsConfirmFn  = createFn('uploads-confirm', 'uploads.ts', 'confirmReceipt');

    const activityListFn   = createFn('activity-list',    'activity.ts',      'list');
    const balancesFn       = createFn('balances',          'activity.ts',      'balances');

    // Grant S3 permissions
    receiptsBucket.grantPut(uploadsUrlFn);
    receiptsBucket.grantRead(expensesListFn);
    receiptsBucket.grantRead(expensesGetFn);
    receiptsBucket.grantRead(tripsGetFn);

    // Grant DynamoDB permissions
    const dynamoFns = [
      tripsCreateFn, tripsGetFn, tripsUpdateFn,
      membersCreateFn, membersListFn, membersRemoveFn,
      expensesCreateFn, expensesListFn, expensesGetFn, expensesUpdateFn, expensesRemoveFn,
      uploadsUrlFn, uploadsConfirmFn,
      activityListFn, balancesFn,
    ];
    for (const fn of dynamoFns) {
      dynamoTable!.grantReadWriteData(fn);
    }

    // HTTP API (API Gateway v2)
    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: 'trip-tally-api',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: [frontendUrl],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Construct ID must be a static string — fn.functionName is a CDK token and cannot be used as an ID
    const integrate = (id: string, fn: lambda.IFunction) =>
      new apigatewayv2Integrations.HttpLambdaIntegration(`${id}-integration`, fn);

    // Routes
    httpApi.addRoutes({ path: '/trips',                                            methods: [apigatewayv2.HttpMethod.POST],   integration: integrate('trips-create',   tripsCreateFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}',                                   methods: [apigatewayv2.HttpMethod.GET],    integration: integrate('trips-get',      tripsGetFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}',                                   methods: [apigatewayv2.HttpMethod.PATCH],  integration: integrate('trips-update',   tripsUpdateFn) });

    httpApi.addRoutes({ path: '/trips/{tripId}/members',                           methods: [apigatewayv2.HttpMethod.POST],   integration: integrate('members-create', membersCreateFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}/members',                           methods: [apigatewayv2.HttpMethod.GET],    integration: integrate('members-list',   membersListFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}/members/{memberId}',                methods: [apigatewayv2.HttpMethod.DELETE], integration: integrate('members-remove', membersRemoveFn) });

    httpApi.addRoutes({ path: '/trips/{tripId}/expenses',                          methods: [apigatewayv2.HttpMethod.POST],   integration: integrate('expenses-create', expensesCreateFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}/expenses',                          methods: [apigatewayv2.HttpMethod.GET],    integration: integrate('expenses-list',   expensesListFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}/expenses/{expenseId}',              methods: [apigatewayv2.HttpMethod.GET],    integration: integrate('expenses-get',    expensesGetFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}/expenses/{expenseId}',              methods: [apigatewayv2.HttpMethod.PATCH],  integration: integrate('expenses-update', expensesUpdateFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}/expenses/{expenseId}',              methods: [apigatewayv2.HttpMethod.DELETE], integration: integrate('expenses-remove', expensesRemoveFn) });

    httpApi.addRoutes({ path: '/trips/{tripId}/expenses/{expenseId}/upload-url',   methods: [apigatewayv2.HttpMethod.POST],   integration: integrate('uploads-url',     uploadsUrlFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}/expenses/{expenseId}/receipt',      methods: [apigatewayv2.HttpMethod.PATCH],  integration: integrate('uploads-confirm', uploadsConfirmFn) });

    httpApi.addRoutes({ path: '/trips/{tripId}/activity',                          methods: [apigatewayv2.HttpMethod.GET],    integration: integrate('activity-list', activityListFn) });
    httpApi.addRoutes({ path: '/trips/{tripId}/balances',                          methods: [apigatewayv2.HttpMethod.GET],    integration: integrate('balances',       balancesFn) });

    this.apiUrl = httpApi.url!;

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      exportName: 'TripTallyApiUrl',
    });
  }
}
