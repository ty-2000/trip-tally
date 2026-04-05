import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly receiptsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.receiptsBucket = new s3.Bucket(this, 'ReceiptsBucket', {
      bucketName: `trip-tally-receipts-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'], // tighten to frontend domain in production
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          // Move receipts to Infrequent Access after 30 days
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    new cdk.CfnOutput(this, 'ReceiptsBucketName', {
      value: this.receiptsBucket.bucketName,
      exportName: 'TripTallyReceiptsBucket',
    });
  }
}
