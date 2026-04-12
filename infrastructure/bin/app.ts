#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DatabaseStack } from '../lib/database-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { DynamoStack } from '../lib/dynamo-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';

// Required env vars for FrontendStack:
//   GITHUB_REPO=owner/repo  (e.g. "myorg/trip-tally")
//   GITHUB_TOKEN_SECRET=trip-tally/github-token  (Secrets Manager secret name)

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

// ------------------------------------------------------------------
// One-time bootstrap: run `cdk deploy TripTallyGitHubOidcStack` once
// with your personal AWS credentials, then use the role ARN for CI.
// Set env var GITHUB_REPO=your-org/trip-tally before deploying.
// ------------------------------------------------------------------
if (process.env.GITHUB_REPO) {
  new GitHubOidcStack(app, 'TripTallyGitHubOidcStack', {
    env,
    githubRepo: process.env.GITHUB_REPO,
  });
}

// Shared VPC — used by both Lambda and RDS
class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // S3 Gateway Endpoint — free, covers Lambda <-> S3 traffic
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Dynamo DB Endpoint — free, covers Lambda <-> Dynamo traffic
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Secrets Manager Interface Endpoint — replaces NAT for secret fetching
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
    });

    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
  }
}

const networkStack = new NetworkStack(app, 'TripTallyNetworkStack', { env });

const databaseStack = new DatabaseStack(app, 'TripTallyDatabaseStack', {
  env,
  vpc: networkStack.vpc,
});
databaseStack.addDependency(networkStack);

const storageStack = new StorageStack(app, 'TripTallyStorageStack', { env });

const dynamoStack = new DynamoStack(app, 'TripTallyDynamoStack', { env });

const apiStack = new ApiStack(app, 'TripTallyApiStack', {
  env,
  vpc: networkStack.vpc,
  lambdaSecurityGroup: databaseStack.lambdaSecurityGroup,
  dbSecret: databaseStack.dbSecret,
  dbHost: databaseStack.dbHost,
  dbPort: databaseStack.dbPort,
  dbName: databaseStack.dbName,
  receiptsBucket: storageStack.receiptsBucket,
  // frontendUrl omitted — defaults to '*' since Amplify URL is only known after deploy
  // dynamoTable always passed so migrate-to-dynamo Lambda gets write access
  dynamoTable: dynamoStack.table,
});
apiStack.addDependency(databaseStack);
apiStack.addDependency(storageStack);
apiStack.addDependency(dynamoStack);

// FrontendStack (Amplify) — only created when GitHub env vars are set.
// GITHUB_REPO format: "owner/repo"
if (process.env.GITHUB_REPO && process.env.GITHUB_TOKEN_SECRET) {
  const [githubOwner, githubRepo] = process.env.GITHUB_REPO.split('/');
  const frontendStack = new FrontendStack(app, 'TripTallyFrontendStack', {
    env,
    apiUrl: apiStack.apiUrl,
    githubOwner,
    githubRepo,
    githubBranch: process.env.GITHUB_BRANCH ?? 'main',
    githubTokenSecretName: process.env.GITHUB_TOKEN_SECRET,
  });
  frontendStack.addDependency(apiStack);
}

app.synth();
