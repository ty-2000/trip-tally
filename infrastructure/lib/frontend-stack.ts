import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch?: string;
  /**
   * Name of the AWS Secrets Manager secret holding the GitHub personal access token.
   * Create it once: aws secretsmanager create-secret --name trip-tally/github-token --secret-string "ghp_xxx"
   */
  githubTokenSecretName: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly appDefaultDomain: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const {
      apiUrl,
      githubOwner,
      githubRepo,
      githubBranch = 'main',
      githubTokenSecretName,
    } = props;

    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('amplify.amazonaws.com'),
        new iam.ServicePrincipal(`amplify.${this.region}.amazonaws.com`),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
    });

    const amplifyApp = new amplify.CfnApp(this, 'AmplifyApp', {
      iamServiceRole: amplifyRole.roleArn,
      name: 'trip-tally',
      platform: 'WEB_COMPUTE',
      repository: `https://github.com/${githubOwner}/${githubRepo}`,
      // GitHub PAT stored in Secrets Manager — resolved by CloudFormation at deploy time
      oauthToken: cdk.SecretValue.secretsManager(githubTokenSecretName).unsafeUnwrap(),
      buildSpec: `version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - "**/*"
      cache:
        paths:
          - node_modules/**/*
    appRoot: frontend-web`,
      environmentVariables: [
        { name: 'NEXT_PUBLIC_API_URL', value: apiUrl },
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: 'frontend-web'},
      ],
    });

    const mainBranch = new amplify.CfnBranch(this, 'MainBranch', {
      appId: amplifyApp.attrAppId,
      branchName: githubBranch,
      enableAutoBuild: true,
    });

    const customDomain = new amplify.CfnDomain(this, 'AmplifyDomain', {
      appId: amplifyApp.attrAppId,
      domainName: 'cornula.com',
      subDomainSettings: [
        // trip-tally.cornula.com → main branch
        { prefix: 'trip-tally', branchName: mainBranch.branchName },
      ],
      // Amplify will automatically create/validate the ACM certificate
      enableAutoSubDomain: false,
    });
    customDomain.addDependency(mainBranch);

    this.appDefaultDomain = amplifyApp.attrDefaultDomain;

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: amplifyApp.attrAppId,
      exportName: 'TripTallyAmplifyAppId',
    });
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: 'https://trip-tally.cornula.com',
      exportName: 'TripTallySiteUrl',
    });
  }
}
