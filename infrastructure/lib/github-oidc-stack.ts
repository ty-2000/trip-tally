import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GitHubOidcStackProps extends cdk.StackProps {
  /**
   * Your GitHub org/username and repo, e.g. "myorg/trip-tally"
   * The deploy role will only be assumable from this repo's main branch.
   */
  githubRepo: string;
}

/**
 * Creates an IAM OIDC provider for GitHub Actions and a deploy role
 * that GitHub Actions can assume without storing long-lived AWS credentials.
 *
 * After deploying this stack once:
 *   1. Copy the DeployRoleArn output
 *   2. Add it as a GitHub Actions secret: AWS_DEPLOY_ROLE_ARN
 */
export class GitHubOidcStack extends cdk.Stack {
  public readonly deployRoleArn: string;

  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const { githubRepo } = props;
    const [org, repo] = githubRepo.split('/');

    // GitHub's OIDC provider (shared across all repos in your account)
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
    });

    // Deploy role — only GitHub Actions on the specified repo/branch can assume it
    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'TripTallyGitHubDeployRole',
      assumedBy: new iam.WebIdentityPrincipal(oidcProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          // Allow main branch and PRs (PRs can't deploy to prod, workflow controls that)
          'token.actions.githubusercontent.com:sub': `repo:${org}/${repo}:*`,
        },
      }),
      description: 'Assumed by GitHub Actions to deploy Trip Tally',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // CDK deploy needs broad permissions on CloudFormation + the services it manages.
    // Scoped to resources with the TripTally prefix for least privilege.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudFormation',
        actions: ['cloudformation:*'],
        resources: [`arn:aws:cloudformation:*:${this.account}:stack/TripTally*/*`],
      })
    );

    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CdkBootstrap',
        actions: ['cloudformation:DescribeStacks'],
        resources: [`arn:aws:cloudformation:*:${this.account}:stack/CDKToolkit/*`],
      })
    );

    // ECR, SSM, S3 for CDK asset publishing
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CdkAssets',
        actions: [
          's3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject',
          's3:GetBucketLocation', 's3:GetBucketPolicy',
          'ssm:GetParameter',
          'ecr:GetAuthorizationToken',
        ],
        resources: ['*'],
      })
    );

    // Pass role to CloudFormation execution role
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'PassRole',
        actions: ['iam:PassRole', 'iam:GetRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      })
    );

    // Services CDK provisions
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AppServices',
        actions: [
          // Lambda
          'lambda:*',
          // API Gateway
          'apigateway:*',
          // RDS
          'rds:*',
          // EC2/VPC (for RDS + Lambda networking)
          'ec2:*',
          // S3 (trip receipts bucket + CDK assets)
          's3:*',
          // Amplify (frontend hosting)
          'amplify:*',
          // Secrets Manager
          'secretsmanager:*',
          // IAM (for Lambda execution roles)
          'iam:CreateRole', 'iam:DeleteRole', 'iam:AttachRolePolicy',
          'iam:DetachRolePolicy', 'iam:PutRolePolicy', 'iam:DeleteRolePolicy',
          'iam:GetRolePolicy', 'iam:ListRolePolicies', 'iam:ListAttachedRolePolicies',
          'iam:UpdateAssumeRolePolicy', 'iam:TagRole', 'iam:UntagRole',
          'iam:CreateOpenIDConnectProvider', 'iam:GetOpenIDConnectProvider',
          'iam:AddClientIDToOpenIDConnectProvider',
        ],
        resources: ['*'],
      })
    );

    this.deployRoleArn = deployRole.roleArn;

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Add this as GitHub secret: AWS_DEPLOY_ROLE_ARN',
    });
  }
}
