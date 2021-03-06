import { Construct, PhysicalName, Stack } from '@aws-cdk/cdk';
import { CfnTopic } from './sns.generated';
import { ITopic, TopicBase } from './topic-base';

/**
 * Properties for a new SNS topic
 */
export interface TopicProps {
  /**
   * A developer-defined string that can be used to identify this SNS topic.
   *
   * @default None
   */
  readonly displayName?: string;

  /**
   * A name for the topic.
   *
   * If you don't specify a name, AWS CloudFormation generates a unique
   * physical ID and uses that ID for the topic name. For more information,
   * see Name Type.
   *
   * @default Generated name
   */
  readonly topicName?: PhysicalName;
}

/**
 * A new SNS topic
 */
export class Topic extends TopicBase {

  public static fromTopicArn(scope: Construct, id: string, topicArn: string): ITopic {
    class Import extends TopicBase {
      public readonly topicArn = topicArn;
      public readonly topicName = Stack.of(scope).parseArn(topicArn).resource;
      protected autoCreatePolicy: boolean = false;
    }

    return new Import(scope, id);
  }

  public readonly topicArn: string;
  public readonly topicName: string;

  protected readonly autoCreatePolicy: boolean = true;

  constructor(scope: Construct, id: string, props: TopicProps = {}) {
    super(scope, id, {
      physicalName: props.topicName,
    });

    const resource = new CfnTopic(this, 'Resource', {
      displayName: props.displayName,
      topicName: this.physicalName,
    });

    const resourceIdentifiers = this.getCrossEnvironmentAttributes({
      arn: resource.ref,
      name: resource.attrTopicName,
      arnComponents: {
        service: 'sns',
        resource: this.physicalName,
      },
    });
    this.topicArn = resourceIdentifiers.arn;
    this.topicName = resourceIdentifiers.name;
  }
}
