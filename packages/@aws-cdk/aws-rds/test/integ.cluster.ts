import ec2 = require('@aws-cdk/aws-ec2');
import kms = require('@aws-cdk/aws-kms');
import cdk = require('@aws-cdk/cdk');
import { SecretValue } from '@aws-cdk/cdk';
import { DatabaseCluster, DatabaseClusterEngine } from '../lib';
import { ClusterParameterGroup } from '../lib/parameter-group';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-rds-integ');

const vpc = new ec2.Vpc(stack, 'VPC', { maxAZs: 2 });

const params = new ClusterParameterGroup(stack, 'Params', {
  family: 'aurora5.6',
  description: 'A nice parameter group',
  parameters: {
    character_set_database: 'utf8mb4'
  }
});

const kmsKey = new kms.Key(stack, 'DbSecurity');
const cluster = new DatabaseCluster(stack, 'Database', {
  engine: DatabaseClusterEngine.Aurora,
  masterUser: {
    username: 'admin',
    password: SecretValue.plainText('7959866cacc02c2d243ecfe177464fe6'),
  },
  instanceProps: {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
    vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    vpc
  },
  parameterGroup: params,
  kmsKey,
});

cluster.connections.allowDefaultPortFromAnyIpv4('Open to the world');

app.synth();
