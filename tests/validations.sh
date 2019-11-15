#!/bin/bash

#Fail on first error
set -e

#Import functions
. ./functions.sh

TEST_WORKSPACE="$(pwd)/spk-env"
[ ! -z "$SPK_LOCATION" ] || { echo "Provide SPK_LOCATION"; exit 1;}
[ ! -z "$ACCESS_TOKEN_SECRET" ] || { echo "Provide ACCESS_TOKEN_SECRET"; exit 1;}
[ ! -z "$AZDO_PROJECT" ] || { echo "Provide AZDO_PROJECT"; exit 1;}
[ ! -z "$AZDO_ORG" ] || { echo "Provide AZDO_ORG"; exit 1;}
[ ! -z "$ACR_NAME" ] || { echo "Provide ACR_NAME"; exit 1;}
AZDO_ORG_URL="${AZDO_ORG_URL:-"https://dev.azure.com/$AZDO_ORG"}"


echo "TEST_WORKSPACE: $TEST_WORKSPACE"
echo "SPK_LOCATION: $SPK_LOCATION"
echo "AZDO_PROJECT: $AZDO_PROJECT"
echo "AZDO_ORG: $AZDO_ORG"
echo "AZDO_ORG_URL: $AZDO_ORG_URL"
echo "ACR_NAME: $ACR_NAME"

branchName=myFeatureBranch
FrontEnd=fabrikam.acme.frontend
BackEnd=fabrikam.acme.backend
hld_dir=fabrikam-hld
manifests_dir=fabrikam-manifests
vg_name=fabrikam-vg
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

# Manifest Repo Setup ------------------
mkdir $manifests_dir
cd $manifests_dir
git init
touch README.md
echo "This is the Flux Manifest Repository." >> README.md
file_we_expect=("README.md")
validate_directory "$TEST_WORKSPACE/$manifests_dir" "${file_we_expect[@]}"

git add -A

# See if the remote repo exists
repo_exists $AZDO_ORG_URL $AZDO_PROJECT $manifests_dir

# Create the remote repo for the local repo
created_repo_result=$(az repos create --name "$manifests_dir" --org $AZDO_ORG_URL --p $AZDO_PROJECT)

# Extract out remote repo URL from the above result
remote_repo_url=$(echo $created_repo_result | jq '.remoteUrl' | tr -d '"' )
echo "The remote_repo_url is $remote_repo_url"

# Remove the user from the URL
repo_url=$(getHostandPath "$remote_repo_url")
manifest_repo_url=$repo_url

# We need to manipulate the remote url to insert a PAT token so we can add an origin git url
git commit -m "inital commit"
# git remote rm origin
git remote add origin https://service_account:$ACCESS_TOKEN_SECRET@$repo_url
echo "git push"
git push -u origin --all
cd ..

# HLD repo set up -----------------------
mkdir $hld_dir
cd $hld_dir
git init
spk hld init
file_we_expect=("spk.log" "manifest-generation.yaml")
validate_directory "$TEST_WORKSPACE/$hld_dir" "${file_we_expect[@]}"

git add -A

# See if the remote repo exists
repo_exists $AZDO_ORG_URL $AZDO_PROJECT $hld_dir

# Create the remote repo for the local repo
created_repo_result=$(az repos create --name "$hld_dir" --org $AZDO_ORG_URL --p $AZDO_PROJECT)

# Extract out remote repo URL from the above result
remote_repo_url=$(echo $created_repo_result | jq '.remoteUrl' | tr -d '"' )
echo "The remote_repo_url is $remote_repo_url"

# Remove the user from the URL
repo_url=$(getHostandPath "$remote_repo_url")
hld_repo_url=$repo_url

# We need to manipulate the remote url to insert a PAT token so we can add an origin git url
git commit -m "inital commit"
# git remote rm origin
git remote add origin https://service_account:$ACCESS_TOKEN_SECRET@$repo_url
echo "git push"
git push -u origin --all
cd ..

# *** TODO: Get ride of duplication

# First we should check hld pipelines exist. If there is a pipeline with the same name we should delete it
hld_pipeline_exists $AZDO_ORG_URL $AZDO_PROJECT $hld_dir $manifests_dir

# Create the hld to manifest pipeline
echo "hld_dir $hld_dir"
echo "hld_repo_url $hld_repo_url"
echo "manifest_repo_url $manifest_repo_url"
spk hld install-manifest-pipeline -o $AZDO_ORG -d $AZDO_PROJECT -p $ACCESS_TOKEN_SECRET -r $hld_dir -u https://$hld_repo_url -m https://$manifest_repo_url

# Verify the pipeline was created
pipeline_created=$(az pipelines show --name $hld_dir-to-$manifests_dir --org $AZDO_ORG_URL --p $AZDO_PROJECT)
# TODO: Verify the pipeline run was successful

# App Code Mono Repo set up 
mkdir $mono_repo_dir
cd $mono_repo_dir
git init

mkdir $services_dir
spk project init >> $TEST_WORKSPACE/log.txt
file_we_expect=("spk.log" ".gitignore" "bedrock.yaml" "maintainers.yaml" "hld-lifecycle.yaml")
validate_directory "$TEST_WORKSPACE/$mono_repo_dir" "${file_we_expect[@]}"

# Does variable group already exist? Delete if so
variable_group_exists $AZDO_ORG_URL $AZDO_PROJECT $vg_name "delete"

# Create variable group
spk project create-variable-group $vg_name -r $ACR_NAME -d $hld_repo_url -u $SP_APP_ID -p $SP_PASS -t $SP_TENANT --org-name $AZDO_ORG --project $AZDO_PROJECT --personal-access-token $ACCESS_TOKEN_SECRET  #>> $TEST_WORKSPACE/log.txt

# Verify the variable group was created. Fail if not
variable_group_exists $AZDO_ORG_URL $AZDO_PROJECT $vg_name "fail"

spk service create $FrontEnd -d $services_dir >> $TEST_WORKSPACE/log.txt
directory_to_check="$services_full_dir/$FrontEnd"
file_we_expect=(".gitignore" "azure-pipelines.yaml" "Dockerfile" )
validate_directory $directory_to_check "${file_we_expect[@]}"

spk service create $BackEnd -d $services_dir >> $TEST_WORKSPACE/log.txt
validate_directory "$services_full_dir/$BackEnd" "${file_we_expect[@]}"

git add -A

# TODO: We aren't using the config file right now
# spk init -f $SPK_CONFIG_FILE

# See if the remote repo exists
repo_exists $AZDO_ORG_URL $AZDO_PROJECT $mono_repo_dir

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
pipeline_exists $AZDO_ORG_URL $AZDO_PROJECT $FrontEnd

# Create a pipeline since the code exists in remote repo
spk service install-build-pipeline -o $AZDO_ORG -r $mono_repo_dir -u $remote_repo_url -d $AZDO_PROJECT -l $services_dir -p $ACCESS_TOKEN_SECRET -v $FrontEnd  >> $TEST_WORKSPACE/log.txt

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
