## Description

This command inserts data about pipeline runs into Azure Table storage.

## Example

The following command has parameters for Azure Table storage credential and
various pipelines run details. It's used by the source build pipeline, the
release stage and the manifest generation pipeline, and each of them pass in
parameters depending on the information for that pipeline. Here are three
examples:

```
bedrock deployment create  -n $AZURE_STORAGE_ACCOUNT_NAME \
    -k $AZURE_ACCOUNT_KEY \
    -t $AZURE_TABLE_NAME  \
    -p $AZURE_TABLE_PARTITION_KEY \
    --p1 $(Build.BuildId) \
    --image-tag $tag_name \
    --commit-id $commitId \
    --service $service \
    --repository $repourl
```

```
bedrock deployment create  -n $AZURE_STORAGE_ACCOUNT_NAME \
    -k $AZURE_ACCOUNT_KEY \
    -t $AZURE_TABLE_NAME  \
    -p $AZURE_TABLE_PARTITION_KEY \
    --p2 $(Build.BuildId) \
    --hld-commit-id $latest_commit \
    --env $(Build.SourceBranchName) \
    --image-tag $tag_name \
    --pr $pr_id \
    --repository $repourl
```

```
bedrock deployment create  -n $AZURE_STORAGE_ACCOUNT_NAME \
    -k $AZURE_ACCOUNT_KEY \
    -t $AZURE_TABLE_NAME  \
    -p $AZURE_TABLE_PARTITION_KEY \
    --p3 $(Build.BuildId) \
    --hld-commit-id $commitId \
    --pr $pr_id \
    --repository $repourl
```
