/// !cdk-integ *
import cdk = require('@aws-cdk/cdk');
import ec2 = require("../lib");

const app = new cdk.App();

// we associate this stack with an explicit environment since this is required by the
// environmental context provider used in `fromLookup`. CDK_INTEG_XXX are set
// when producing the .expected file and CDK_DEFAULT_XXX is passed in through from
// the CLI in actual deployment.
const env = {
  account: process.env.CDK_INTEG_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_INTEG_REGION || process.env.CDK_DEFAULT_REGION
};

const stack = new cdk.Stack(app, 'aws-cdk-ec2-import', { env });

/// !show
const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
  // This imports the default VPC but you can also
  // specify a 'vpcName' or 'tags'.
  isDefault: true
});
/// !hide

// The only thing in this library that takes a VPC as an argument :)
new ec2.SecurityGroup(stack, 'SecurityGroup', {
  vpc
});

// Try subnet selection
new cdk.CfnOutput(stack, 'PublicSubnets', { value: 'ids:' + vpc.publicSubnets.map(s => s.subnetId).join(',') });
new cdk.CfnOutput(stack, 'PrivateSubnets', { value: 'ids:' + vpc.privateSubnets.map(s => s.subnetId).join(',') });

app.synth();
