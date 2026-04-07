import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly dbSecret: secretsmanager.ISecret;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  /** Lambda functions must use this SG to reach RDS — created here to avoid a cross-stack cycle. */
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly dbHost: string;
  public readonly dbPort: string;
  public readonly dbName: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    this.dbName = 'triptally';

    // Lambda SG lives here (same stack as dbSecurityGroup) so we can add the
    // ingress rule without creating a cross-stack reference that would cause a cycle.
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc,
      description: 'Lambda functions - allows outbound to RDS',
    });

    // Security group for Aurora — only allows inbound from the Lambda SG above
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSG', {
      vpc,
      description: 'Allow inbound PostgreSQL from Lambda',
      allowAllOutbound: false,
    });

    this.dbSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to PostgreSQL'
    );

    // Aurora credentials stored in Secrets Manager
    const dbCredentials = rds.Credentials.fromGeneratedSecret('triptally_admin', {
      secretName: 'trip-tally/db-credentials',
    });

    const cluster = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_8,
      }),
      credentials: dbCredentials,
      defaultDatabaseName: this.dbName,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      serverlessV2MinCapacity: 0.5,  // minimum ACU — scales down when idle
      serverlessV2MaxCapacity: 4,    // maximum ACU — increase for higher load
      writer: rds.ClusterInstance.serverlessV2('writer'),
      // No reader — add one here if read replicas are needed
      storageEncrypted: true,
      backup: { retention: cdk.Duration.days(7) },
      deletionProtection: false,     // set to true for production
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    this.dbSecret = cluster.secret!;
    this.dbHost = cluster.clusterEndpoint.hostname;
    this.dbPort = cluster.clusterEndpoint.port.toString();

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: cluster.clusterEndpoint.hostname,
      exportName: 'TripTallyDbEndpoint',
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
      exportName: 'TripTallyDbSecretArn',
    });
  }
}
