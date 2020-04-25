#!/bin/bash

#Fail on first error
set -e

#Import functions
. ./functions.sh

TEST_WORKSPACE="$(pwd)/bedrock-env"
[ ! -z "$BEDROCK_CLI_LOCATION" ] || { echo "Provide BEDROCK_CLI_LOCATION"; exit 1;}
[ ! -z "$ACCESS_TOKEN_SECRET" ] || { echo "Provide ACCESS_TOKEN_SECRET"; exit 1;}
[ ! -z "$AZDO_PROJECT" ] || { echo "Provide AZDO_PROJECT"; exit 1;}
[ ! -z "$AZDO_ORG" ] || { echo "Provide AZDO_ORG"; exit 1;}
[ ! -z "$ACR_NAME" ] || { echo "Provide ACR_NAME"; exit 1;}
[ ! -z "$SP_APP_ID" ] || { echo "Provide SP_APP_ID"; exit 1;}
[ ! -z "$SP_PASS" ] || { echo "Provide SP_PASS"; exit 1;}
[ ! -z "$SP_TENANT" ] || { echo "Provide SP_TENANT"; exit 1;}
AZDO_ORG_URL="${AZDO_ORG_URL:-"https://dev.azure.com/$AZDO_ORG"}"

echo "TEST_WORKSPACE: $TEST_WORKSPACE"
echo "BEDROCK_CLI_LOCATION: $BEDROCK_CLI_LOCATION"
echo "AZDO_PROJECT: $AZDO_PROJECT"
echo "AZDO_ORG: $AZDO_ORG"
echo "AZDO_ORG_URL: $AZDO_ORG_URL"
echo "ACR_NAME: $ACR_NAME"

branchName=dev-ring
FrontEnd=fabrikam.acme.frontend
BackEnd=fabrikam.acme.backend
hld_dir=fabrikam-hld
manifests_dir=fabrikam-manifests
vg_name=fabrikam-vg
services_dir=services
mono_repo_dir=fabrikam2019
frontend_repo_dir=fabrikam-frontend
backend_repo_dir=fabrikam-backend
helm_charts_dir=helm-charts
services_full_dir="$TEST_WORKSPACE/$mono_repo_dir/$services_dir"
single_app_full_dir="$TEST_WORKSPACE/$frontend_repo_dir"

shopt -s expand_aliases
alias bedrock=$BEDROCK_CLI_LOCATION
echo "Bedrock CLI Version: $(bedrock --version)"

echo "Running from $(pwd)"
if [ -d "$TEST_WORKSPACE"  ]; then rm -Rf $TEST_WORKSPACE; fi

if [ ! -d "$TEST_WORKSPACE" ]; then
  echo "Directory '$TEST_WORKSPACE' does not exist"
  mkdir $TEST_WORKSPACE
  echo "Created '$TEST_WORKSPACE'"
fi

##################################
# Helm Chart template Setup START
##################################
cp helm-artifacts/* $TEST_WORKSPACE
# --------------------------------

cd $TEST_WORKSPACE

##################################
# Manifest Repo Setup START
##################################
create_manifest_repo $manifests_dir
cd $manifests_dir
validate_directory "$TEST_WORKSPACE/$manifests_dir" "${file_we_expect[@]}"
git add -A

# See if the remote repo exists
repo_exists $AZDO_ORG_URL $AZDO_PROJECT $manifests_dir
push_remote_git_repo $AZDO_ORG_URL $AZDO_PROJECT $manifests_dir
manifest_repo_url=$(get_remote_repo_url $AZDO_ORG_URL $AZDO_PROJECT $manifests_dir)
# --------------------------------

##################################
# HLD Repo Setup START
##################################
create_hld_repo $hld_dir $BEDROCK_CLI_LOCATION
validate_directory "$TEST_WORKSPACE/$hld_dir" "${file_we_expect[@]}"
cd "$TEST_WORKSPACE/$hld_dir"
git add -A

# See if the remote repo exists
repo_exists $AZDO_ORG_URL $AZDO_PROJECT $hld_dir
push_remote_git_repo $AZDO_ORG_URL $AZDO_PROJECT $hld_dir
hld_repo_url=$(get_remote_repo_url $AZDO_ORG_URL $AZDO_PROJECT $hld_dir)
# --------------------------------

##################################
# HLD to Manifest Pipeline Setup Start
##################################
# First we should check hld pipelines exist. If there is a pipeline with the same name we should delete it
hld_to_manifest_pipeline_name=$hld_dir-to-$manifests_dir
pipeline_exists $AZDO_ORG_URL $AZDO_PROJECT $hld_to_manifest_pipeline_name

# Create the hld to manifest pipeline
echo "hld_dir $hld_dir"
echo "hld_repo_url $hld_repo_url"
echo "manifest_repo_url $manifest_repo_url"
bedrock hld install-manifest-pipeline --org-name $AZDO_ORG -d $AZDO_PROJECT --personal-access-token $ACCESS_TOKEN_SECRET -r $hld_dir -u $hld_repo_url -m $manifest_repo_url >> $TEST_WORKSPACE/log.txt

# Verify hld to manifest pipeline was created
pipeline_created=$(az pipelines show --name $hld_to_manifest_pipeline_name --org $AZDO_ORG_URL --p $AZDO_PROJECT)

# Verify hld to manifest pipeline run was successful
verify_pipeline_with_poll $AZDO_ORG_URL $AZDO_PROJECT $hld_to_manifest_pipeline_name 300 15
cd ..
# --------------------------------

##################################
# Helm Chart Repo Setup START
##################################
cd $TEST_WORKSPACE
create_helm_chart_repo $helm_charts_dir $frontend_repo_dir $TEST_WORKSPACE $ACR_NAME
cd "$TEST_WORKSPACE/$helm_charts_dir"
git add -A

# See if the remote repo exists
repo_exists $AZDO_ORG_URL $AZDO_PROJECT $helm_charts_dir
push_remote_git_repo $AZDO_ORG_URL $AZDO_PROJECT $helm_charts_dir
# --------------------------------

##################################
# Single App Repo Setup START
##################################
cd $TEST_WORKSPACE
create_bedrock_project_and_service $AZDO_ORG_URL $AZDO_PROJECT $BEDROCK_CLI_LOCATION $TEST_WORKSPACE $frontend_repo_dir $vg_name "http://$repo_url"

git add -A
# See if the remote repo exists
repo_exists $AZDO_ORG_URL $AZDO_PROJECT $frontend_repo_dir
push_remote_git_repo $AZDO_ORG_URL $AZDO_PROJECT $frontend_repo_dir
# --------------------------------

##################################
# Single App Repo LIFECYCLE Pipeline Setup START
##################################
frontend_repo_url="$AZDO_ORG_URL/$AZDO_PROJECT/_git/$frontend_repo_dir"
cd "$TEST_WORKSPACE/$frontend_repo_dir"

# First we should check lifecycle pipelines exist. If there is a pipeline with the same name we should delete it
lifecycle_pipeline_name="$frontend_repo_dir-lifecycle"
pipeline_exists $AZDO_ORG_URL $AZDO_PROJECT $lifecycle_pipeline_name

# Deploy lifecycle pipeline and verify it runs.
bedrock project install-lifecycle-pipeline --org-name $AZDO_ORG --devops-project $AZDO_PROJECT --repo-url $frontend_repo_url --repo-name $frontend_repo_dir --pipeline-name $lifecycle_pipeline_name --personal-access-token $ACCESS_TOKEN_SECRET  >> $TEST_WORKSPACE/log.txt

# Verify lifecycle pipeline was created
pipeline_created=$(az pipelines show --name $lifecycle_pipeline_name --org $AZDO_ORG_URL --p $AZDO_PROJECT)

# Verify lifecycle pipeline run was successful
verify_pipeline_with_poll $AZDO_ORG_URL $AZDO_PROJECT "$frontend_repo_dir-lifecycle" 180 15

# Approve pull request from lifecycle pipeline
echo "Finding pull request that $frontend_repo_dir-lifecycle pipeline created..."
approve_pull_request_v2 $AZDO_ORG_URL $AZDO_PROJECT "Reconciling HLD"
# --------------------------------

##################################
# Single App Repo BUILD Pipeline Setup START
##################################
# If there is a pipeline with the same name we should delete it
frontend_pipeline_name="$frontend_repo_dir-pipeline"
pipeline_exists $AZDO_ORG_URL $AZDO_PROJECT $frontend_pipeline_name

# Create a pipeline since the code exists in remote repo
bedrock service install-build-pipeline --org-name $AZDO_ORG -r $frontend_repo_dir -u $frontend_repo_url -d $AZDO_PROJECT --personal-access-token $ACCESS_TOKEN_SECRET -n $frontend_pipeline_name . >> $TEST_WORKSPACE/log.txt

# Verify frontend service pipeline was created
pipeline_created=$(az pipelines show --name $frontend_pipeline_name --org $AZDO_ORG_URL --p $AZDO_PROJECT)

# Verify frontend service pipeline run was successful
verify_pipeline_with_poll $AZDO_ORG_URL $AZDO_PROJECT $frontend_pipeline_name 300 15

echo "Finding pull request that $frontend_pipeline_name pipeline created..."
approve_pull_request_v2 $AZDO_ORG_URL $AZDO_PROJECT "Updating $frontend_repo_dir-service image tag to master"



# TODO: Bug fix incoming --> Image tag not updated: https://github.com/microsoft/bedrock/issues/908
# Uncomment below when fixed
# echo "Finding pull request that $frontend_pipeline_name pipeline created..."
# approve_pull_request_v2 $AZDO_ORG_URL $AZDO_PROJECT "Reconciling HLD"

# NOTE ##################################
# The PR starts with "Merge DEPLOY/fabrikam-frontend"
# After approved the HLD to Manifest pipeline will run
# We then need to do a git pull on the manifest repo we have locally and validate that the docker image tag is correct.
# Then perhaps kubectl push or have flux setup to pull

# Uncomment below when fixed
# echo "Finding pull request in $frontend_repo_dir-lifecycle pipeline created (triggered from $frontend_pipeline_name pipeline"
# approve_pull_request_v2 $AZDO_ORG_URL $AZDO_PROJECT "Merge DEPLOY/$frontend_repo_dir"

# Start creating a service revision
echo "Creating service revision"
git branch $branchName
git checkout $branchName
echo "# My New Added File" >> myNewFile.md
git add myNewFile.md
git commit -m "Adding my new file"
git push --set-upstream origin $branchName

# Create a PR for the change
current_time=$(date +"%Y-%m-%d-%H-%M-%S")
pr_title="Automated Test PR $current_time"
echo "Creating pull request: '$pr_title'" 
bedrock service create-revision -t "$pr_title" -d "Adding my new file" --org-name $AZDO_ORG --personal-access-token $ACCESS_TOKEN_SECRET --remote-url $frontend_repo_url >> $TEST_WORKSPACE/log.txt

echo "Attempting to approve pull request: '$pr_title'" 
# Get the id of the pr created and set the PR to be approved
approve_pull_request_v2 $AZDO_ORG_URL $AZDO_PROJECT "$pr_title"

echo "Successfully reached the end of the validations scripts."

# --------------------------------




echo "Test is still in development but successful so far" 



