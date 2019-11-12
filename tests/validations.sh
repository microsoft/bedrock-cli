#!/bin/bash

#Fail on first error
set -e 

#Import functions
. ./functions.sh

TEST_WORKSPACE="$(pwd)/spk-env"
SPK_LOCATION="${SPK_PATH:-"~/Code/spk/dist/spk-macos"}"
ACCESS_TOKEN_SECRET="${ACCESS_TOKEN_SECRET:-"REPLACE_ME"}"
AZDO_PROJECT="${AZDO_PROJECT:-"bedrock"}"
AZDO_ORG="${AZDO_ORG:-"epicstuff"}"
AZDO_ORG_URL="${AZDO_ORG_URL:-"https://dev.azure.com/epicstuff"}"

echo "TEST_WORKSPACE: $TEST_WORKSPACE"
echo "SPK_LOCATION: $SPK_LOCATION"
echo "AZDO_PROJECT: $AZDO_PROJECT"
echo "AZDO_ORG: $AZDO_ORG"
echo "AZDO_ORG_URL: $AZDO_ORG_URL"

branchName=myFeatureBranch
FrontEnd=Fabrikam.Acme.FrontEnd
BackEnd=Fabrikam.Acme.BackEnd
services_dir=services
mono_repo_dir=fabrikam2019
services_full_dir="$TEST_WORKSPACE/$mono_repo_dir/$services_dir"

shopt -s expand_aliases
alias spk=$SPK_LOCATION
echo "SPK Version: $(spk --version)"

echo "Running from $(pwd)"
if [ -d "$TEST_WORKSPACE"  ]; then rm -Rf $TEST_WORKSPACE; fi

if [ ! -d "$TEST_WORKSPACE" ]; then
  echo "Directory '$TEST_WORKSPACE' does not exist"
  mkdir $TEST_WORKSPACE
  echo "Created '$TEST_WORKSPACE'"
fi

cd $TEST_WORKSPACE
mkdir $mono_repo_dir
cd $mono_repo_dir
git init

mkdir $services_dir
spk project init -m -d $services_dir >> $TEST_WORKSPACE/log.txt
file_we_expect=("spk.log" "bedrock.yaml" "maintainers.yaml" "hld-lifecycle.yaml")
validate_directory "$TEST_WORKSPACE/$mono_repo_dir" "${file_we_expect[@]}"

spk service create $FrontEnd -d $services_dir >> $TEST_WORKSPACE/log.txt
directory_to_check="$services_full_dir/$FrontEnd"
file_we_expect=(".gitignore" "azure-pipelines.yaml" "Dockerfile" )
validate_directory $directory_to_check "${file_we_expect[@]}"

spk service create $BackEnd -d $services_dir >> $TEST_WORKSPACE/log.txt
validate_directory "$services_full_dir/$BackEnd" "${file_we_expect[@]}"

git add -A

# TODO: We aren't using the config file right now
# spk init -f $SPK_CONFIG_FILE

# TODO: We don't delete/create the variable groups 
# spk variable-group create -o $AZDO_ORG -p $AZDO_PROJECT -f spk-vg.yaml -t $ACCESS_TOKEN_SECRET

# See if the remote repo exists
repo_result=$(az repos list --org $AZDO_ORG_URL -p $AZDO_PROJECT)
repo_exists=$(echo $repo_result | jq -r --arg mono_repo_dir "$mono_repo_dir" '.[].name | select(. == $mono_repo_dir ) != null')

if [ "$repo_exists" = "true" ]; then
    echo "The repo '$mono_repo_dir' already exists "
    # Get the repo id
    repo_id=$(echo "$repo_result"  | jq -r --arg mono_repo_dir "$mono_repo_dir" '.[] | select(.name == $mono_repo_dir) | .id')
    echo "repo_id to delete is $repo_id"
    # Delete the repo
    az repos delete --id "$repo_id" --yes --org $AZDO_ORG_URL --p $AZDO_PROJECT
fi

# Create the remote repo for the local repo
created_repo_result=$(az repos create --name "$mono_repo_dir" --org $AZDO_ORG_URL --p $AZDO_PROJECT)

# Extract out remote repo URL from the above result 
remote_repo_url=$(echo $created_repo_result | jq '.remoteUrl' | tr -d '"' )
echo "The remote_repo_url is $remote_repo_url"

# Remove the user from the URL
repo_url=$(getHostandPath "$remote_repo_url")

# We need to manipulate the remote url to insert a PAT token so we can 
git commit -m "inital commit"
git remote add origin https://service_account:$ACCESS_TOKEN_SECRET@$repo_url 
echo "git push"
git push -u origin --all


# First we should check what pipelines exist. If there is a pipeline with the same name we should delete it 
pipeline_results=$(az pipelines list)
pipeline_exists=$(tr '"\""' '"\\"' <<< "$pipeline_results" | jq -r --arg FrontEnd "$FrontEnd-pipeline" '.[].name  | select(. == $FrontEnd ) != null')

if [ "$pipeline_exists" = "true" ]; then
    echo "The pipeline '$FrontEnd-pipeline' already exists "
    # Get the pipeline id. We have to replace single "\" with "\\" 
    pipeline_id=$(tr '"\""' '"\\"' <<<"$pipeline_results"  | jq -r --arg FrontEnd "$FrontEnd-pipeline" '.[] | select(.name == $FrontEnd) | .id')
    echo "pipeline_id to delete is $pipeline_id"
    # Delete the repo
     az pipelines delete --id "$pipeline_id" --yes --org $AZDO_ORG_URL --p $AZDO_PROJECT
fi

# Create a pipeline since the code exists in remote repo
spk service create-pipeline -o $AZDO_ORG -r $mono_repo_dir -u $remote_repo_url -d $AZDO_PROJECT -l $services_dir -p $ACCESS_TOKEN_SECRET -v $FrontEnd  >> $TEST_WORKSPACE/log.txt

# Verify the pipeline was created 
pipeline_created=$(az pipelines show --name $FrontEnd-pipeline --org $AZDO_ORG_URL --p $AZDO_PROJECT)
# TODO: Verify the pipeline run was successful

# Start creating a service revision
git branch $branchName
git checkout $branchName
echo "# My New Added File" >> myNewFile.md
git add myNewFile.md
git commit -m "Adding my new file"
git push --set-upstream origin $branchName

# Create a PR for the change
spk service create-revision -t "Automated Test PR" -d "Adding my new file" --org-name $AZDO_ORG --personal-access-token $ACCESS_TOKEN_SECRET  --remote-url $remote_repo_url >> $TEST_WORKSPACE/log.txt

# TODO: Get the id of the pr created and set the PR to be approved 
# az repos pr update --id --bypass-policy --auto-complete   