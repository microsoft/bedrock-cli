## Description

This command inserts data about pipeline runs into Azure Table storage.

## Example

The following command has parameters for Azure Table storage credential and
various pipelines run details.

```
spk deployment create  -n $AZURE_STORAGE_ACCOUNT_NAME \
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
