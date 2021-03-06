import ec2 = require('@aws-cdk/aws-ec2');
import iam = require('@aws-cdk/aws-iam');
import sfn = require('@aws-cdk/aws-stepfunctions');
import { Construct, Stack } from '@aws-cdk/cdk';
import { BatchStrategy, S3DataType, TransformInput, TransformOutput, TransformResources } from './sagemaker-task-base-types';

/**
 *  @experimental
 */
export interface SagemakerTransformProps {

    /**
     * Training Job Name.
     */
    readonly transformJobName: string;

    /**
     * Role for thte Training Job.
     */
    readonly role?: iam.IRole;

    /**
     * Specify if the task is synchronous or asychronous.
     */
    readonly synchronous?: boolean;

    /**
     * Number of records to include in a mini-batch for an HTTP inference request.
     */
    readonly batchStrategy?: BatchStrategy;

    /**
     * Environment variables to set in the Docker container.
     */
    readonly environment?: {[key: string]: any};

    /**
     * Maximum number of parallel requests that can be sent to each instance in a transform job.
     */
    readonly maxConcurrentTransforms?: number;

    /**
     * Maximum allowed size of the payload, in MB.
     */
    readonly maxPayloadInMB?: number;

    /**
     * Name of the model that you want to use for the transform job.
     */
    readonly modelName: string;

    /**
     * Tags to be applied to the train job.
     */
    readonly tags?: {[key: string]: any};

    /**
     * Dataset to be transformed and the Amazon S3 location where it is stored.
     */
    readonly transformInput: TransformInput;

    /**
     * S3 location where you want Amazon SageMaker to save the results from the transform job.
     */
    readonly transformOutput: TransformOutput;

    /**
     * ML compute instances for the transform job.
     */
    readonly transformResources?: TransformResources;
}

/**
 * Class representing the SageMaker Create Training Job task.
 *
 *  @experimental
 */
export class SagemakerTransformTask implements sfn.IStepFunctionsTask {

    /**
     * The execution role for the Sagemaker training job.
     *
     * @default new role for Amazon SageMaker to assume is automatically created.
     */
    public readonly role: iam.IRole;

    /**
     * Dataset to be transformed and the Amazon S3 location where it is stored.
     */
    private readonly transformInput: TransformInput;

    /**
     * ML compute instances for the transform job.
     */
    private readonly transformResources: TransformResources;

    constructor(scope: Construct, private readonly props: SagemakerTransformProps) {

        // set the sagemaker role or create new one
        this.role = props.role || new iam.Role(scope, 'SagemakerRole', {
            assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess')
            ]
        });

        // set the S3 Data type of the input data config objects to be 'S3Prefix' if not defined
        this.transformInput = (props.transformInput.transformDataSource.s3DataSource.s3DataType) ? (props.transformInput) :
            Object.assign({}, props.transformInput,
                { transformDataSource:
                    { s3DataSource:
                        { ...props.transformInput.transformDataSource.s3DataSource,
                        s3DataType: S3DataType.S3_PREFIX
                        }
                    }
            });

        // set the default value for the transform resources
        this.transformResources = props.transformResources || {
            instanceCount: 1,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.M4, ec2.InstanceSize.XLARGE),
        };
    }

    public bind(task: sfn.Task): sfn.StepFunctionsTaskConfig {
        return {
          resourceArn: 'arn:aws:states:::sagemaker:createTransformJob' + (this.props.synchronous ? '.sync' : ''),
          parameters: this.renderParameters(),
          policyStatements: this.makePolicyStatements(task),
        };
    }

    private renderParameters(): {[key: string]: any} {
        return {
            ...(this.props.batchStrategy) ? { BatchStrategy: this.props.batchStrategy } : {},
            ...(this.renderEnvironment(this.props.environment)),
            ...(this.props.maxConcurrentTransforms) ? { MaxConcurrentTransforms: this.props.maxConcurrentTransforms } : {},
            ...(this.props.maxPayloadInMB) ? { MaxPayloadInMB: this.props.maxPayloadInMB } : {},
            ModelName: this.props.modelName,
            ...(this.renderTags(this.props.tags)),
            ...(this.renderTransformInput(this.transformInput)),
            TransformJobName: this.props.transformJobName,
            ...(this.renderTransformOutput(this.props.transformOutput)),
            ...(this.renderTransformResources(this.transformResources)),
        };
    }

    private renderTransformInput(input: TransformInput): {[key: string]: any} {
        return {
            TransformInput: {
                ...(input.compressionType) ? { CompressionType: input.compressionType } : {},
                ...(input.contentType) ? { ContentType: input.contentType } : {},
                DataSource: {
                    S3DataSource: {
                        S3Uri: input.transformDataSource.s3DataSource.s3Uri,
                        S3DataType: input.transformDataSource.s3DataSource.s3DataType,
                    }
                },
                ...(input.splitType) ? { SplitType: input.splitType } : {},
            }
        };
    }

    private renderTransformOutput(output: TransformOutput): {[key: string]: any} {
        return {
            TransformOutput: {
                S3OutputPath: output.s3OutputPath,
                ...(output.encryptionKey) ? { KmsKeyId: output.encryptionKey.keyArn } : {},
                ...(output.accept) ? { Accept: output.accept } : {},
                ...(output.assembleWith) ? { AssembleWith: output.assembleWith } : {},
            }
        };
    }

    private renderTransformResources(resources: TransformResources): {[key: string]: any} {
        return {
            TransformResources: {
                InstanceCount: resources.instanceCount,
                InstanceType: 'ml.' + resources.instanceType,
                ...(resources.volumeKmsKeyId) ? { VolumeKmsKeyId: resources.volumeKmsKeyId.keyArn } : {},
            }
        };
    }

    private renderEnvironment(environment: {[key: string]: any} | undefined): {[key: string]: any} {
        return (environment) ? { Environment: environment } : {};
    }

    private renderTags(tags: {[key: string]: any} | undefined): {[key: string]: any} {
        return (tags) ? { Tags: Object.keys(tags).map(key => ({ Key: key, Value: tags[key] })) } : {};
    }

    private makePolicyStatements(task: sfn.Task): iam.PolicyStatement[] {
        const stack = Stack.of(task);

        // https://docs.aws.amazon.com/step-functions/latest/dg/sagemaker-iam.html
        const policyStatements = [
            new iam.PolicyStatement({
                actions: ['sagemaker:CreateTransformJob', 'sagemaker:DescribeTransformJob', 'sagemaker:StopTransformJob'],
                resources: [stack.formatArn({
                    service: 'sagemaker',
                    resource: 'transform-job',
                    resourceName: '*'
                })]
            }),
            new iam.PolicyStatement({
                actions: ['sagemaker:ListTags'],
                resources: ['*'],
            }),
            new iam.PolicyStatement({
                actions: ['iam:PassRole'],
                resources: [this.role.roleArn],
                conditions: {
                    StringEquals: { "iam:PassedToService": "sagemaker.amazonaws.com" }
                }
            })
        ];

        if (this.props.synchronous) {
            policyStatements.push(new iam.PolicyStatement({
                actions: ["events:PutTargets", "events:PutRule", "events:DescribeRule"],
                resources: [stack.formatArn({
                    service: 'events',
                    resource: 'rule',
                    resourceName: 'StepFunctionsGetEventsForSageMakerTransformJobsRule'
                }) ]
            }));
        }

        return policyStatements;
      }
}
