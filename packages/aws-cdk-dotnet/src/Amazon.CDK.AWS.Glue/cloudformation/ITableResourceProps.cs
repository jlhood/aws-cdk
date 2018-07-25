using Amazon.CDK;
using Amazon.CDK.AWS.Glue.cloudformation.TableResource;
using AWS.Jsii.Runtime.Deputy;

namespace Amazon.CDK.AWS.Glue.cloudformation
{
    /// <remarks>link: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-glue-table.html </remarks>
    [JsiiInterface(typeof(ITableResourceProps), "@aws-cdk/aws-glue.cloudformation.TableResourceProps")]
    public interface ITableResourceProps
    {
        /// <summary>``AWS::Glue::Table.CatalogId``</summary>
        /// <remarks>link: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-glue-table.html#cfn-glue-table-catalogid </remarks>
        [JsiiProperty("catalogId", "{\"union\":{\"types\":[{\"primitive\":\"string\"},{\"fqn\":\"@aws-cdk/cdk.Token\"}]}}")]
        object CatalogId
        {
            get;
            set;
        }

        /// <summary>``AWS::Glue::Table.DatabaseName``</summary>
        /// <remarks>link: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-glue-table.html#cfn-glue-table-databasename </remarks>
        [JsiiProperty("databaseName", "{\"union\":{\"types\":[{\"primitive\":\"string\"},{\"fqn\":\"@aws-cdk/cdk.Token\"}]}}")]
        object DatabaseName
        {
            get;
            set;
        }

        /// <summary>``AWS::Glue::Table.TableInput``</summary>
        /// <remarks>link: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-glue-table.html#cfn-glue-table-tableinput </remarks>
        [JsiiProperty("tableInput", "{\"union\":{\"types\":[{\"fqn\":\"@aws-cdk/cdk.Token\"},{\"fqn\":\"@aws-cdk/aws-glue.cloudformation.TableResource.TableInputProperty\"}]}}")]
        object TableInput
        {
            get;
            set;
        }
    }
}