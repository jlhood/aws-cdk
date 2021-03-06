import { App, PhysicalName, Stack } from "@aws-cdk/cdk";
import { AccountRootPrincipal, Policy, PolicyStatement, Role, ServicePrincipal } from "../lib";

const app = new App();

const stack = new Stack(app, 'integ-iam-role-1');

const role = new Role(stack, 'TestRole', {
  assumedBy: new ServicePrincipal('sqs.amazonaws.com')
});

role.addToPolicy(new PolicyStatement({ resources: ['*'], actions: ['sqs:SendMessage'] }));

const policy = new Policy(stack, 'HelloPolicy', { policyName: PhysicalName.of('Default') });
policy.addStatements(new PolicyStatement({ actions: ['ec2:*'], resources: ['*'] }));
policy.attachToRole(role);

// Role with an external ID
new Role(stack, 'TestRole2', {
  assumedBy: new AccountRootPrincipal(),
  externalId: 'supply-me',
});

app.synth();
