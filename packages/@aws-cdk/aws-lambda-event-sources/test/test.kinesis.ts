import { expect, haveResource } from '@aws-cdk/assert';
import kinesis = require('@aws-cdk/aws-kinesis');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/cdk');
import { Test } from 'nodeunit';
import sources = require('../lib');
import { TestFunction } from './test-function';

// tslint:disable:object-literal-key-quotes

export = {
  'sufficiently complex example'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    fn.addEventSource(new sources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON
    }));

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      "PolicyDocument": {
        "Statement": [
          {
            "Action": [
              "kinesis:DescribeStream",
              "kinesis:GetRecords",
              "kinesis:GetShardIterator"
            ],
            "Effect": "Allow",
            "Resource": {
              "Fn::GetAtt": [
                "S509448A1",
                "Arn"
              ]
            }
          }
        ],
        "Version": "2012-10-17"
      },
      "PolicyName": "FnServiceRoleDefaultPolicyC6A839BF",
      "Roles": [{
        "Ref": "FnServiceRoleB9001A96"
      }]
    }));

    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      "EventSourceArn": {
        "Fn::GetAtt": [
          "S509448A1",
          "Arn"
        ]
      },
      "FunctionName":  {
        "Ref": "Fn9270CBC0"
      },
      "BatchSize": 100,
      "StartingPosition": "TRIM_HORIZON"
    }));

    test.done();
  },

  'specific batch size'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    fn.addEventSource(new sources.KinesisEventSource(stream, {
      batchSize: 50,
      startingPosition: lambda.StartingPosition.LATEST
    }));

    // THEN
    expect(stack).to(haveResource('AWS::Lambda::EventSourceMapping', {
      "EventSourceArn": {
        "Fn::GetAtt": [
          "S509448A1",
          "Arn"
        ]
      },
      "FunctionName":  {
        "Ref": "Fn9270CBC0"
      },
      "BatchSize": 50,
      "StartingPosition": "LATEST"
    }));

    test.done();
  },

  'fails if batch size < 1'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    test.throws(() => fn.addEventSource(new sources.KinesisEventSource(stream, {
      batchSize: 0,
      startingPosition: lambda.StartingPosition.LATEST
    })), /Maximum batch size must be between 1 and 10000 inclusive \(given 0\)/);

    test.done();
  },

  'fails if batch size > 10000'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const fn = new TestFunction(stack, 'Fn');
    const stream = new kinesis.Stream(stack, 'S');

    // WHEN
    test.throws(() => fn.addEventSource(new sources.KinesisEventSource(stream, {
      batchSize: 10001,
      startingPosition: lambda.StartingPosition.LATEST
    })), /Maximum batch size must be between 1 and 10000 inclusive \(given 10001\)/);

    test.done();
  },
};
