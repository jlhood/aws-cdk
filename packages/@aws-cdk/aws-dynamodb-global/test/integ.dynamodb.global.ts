/// !cdk-integ *
import { AttributeType } from '@aws-cdk/aws-dynamodb';
import { App, PhysicalName } from '@aws-cdk/cdk';
import { GlobalTable } from '../lib';

const app = new App();
new GlobalTable(app, 'globdynamodbinteg', {
  partitionKey: { name: 'hashKey', type: AttributeType.STRING },
  tableName: PhysicalName.of('integrationtest'),
  regions: [ "us-east-1", "us-east-2", "us-west-2" ]
});
app.synth();
