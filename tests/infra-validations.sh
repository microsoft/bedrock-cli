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
[ ! -z "$SP_APP_ID" ] || { echo "Provide SP_APP_ID"; exit 1;}
[ ! -z "$SP_PASS" ] || { echo "Provide SP_PASS"; exit 1;}
[ ! -z "$SP_TENANT" ] || { echo "Provide SP_TENANT"; exit 1;}
AZDO_ORG_URL="${AZDO_ORG_URL:-"https://dev.azure.com/$AZDO_ORG"}"


echo "TEST_WORKSPACE: $TEST_WORKSPACE"
echo "SPK_LOCATION: $SPK_LOCATION"
echo "AZDO_PROJECT: $AZDO_PROJECT"
echo "AZDO_ORG: $AZDO_ORG"
echo "AZDO_ORG_URL: $AZDO_ORG_URL"
echo "ACR_NAME: $ACR_NAME"


terraform_template_dir=discovery-tf-template
tf_template_version=v0.0.1
infra_hld_dir=discovery-infra-hld
services_full_dir="$TEST_WORKSPACE/$mono_repo_dir/$services_dir"

validation_test_yaml="rg_name: <insert value>"

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

# Setup simple TF Template ------------------
mkdir $terraform_template_dir
cd $terraform_template_dir
git init
mkdir template
cd template
tfTemplate=$'resource "azurerm_resource_group" "example"{\n name= "${var.rg_name}"\n location = "${var.rg_location}"\n}'
tfVars=$'variable "rg_name" { \n type = "string" \n } \n variable "rg_location" { \n type = "string" \n }'
backendTfVars=$'storage_account_name="<storage account name>"'
touch main.tf variables.tf backend.tfvars
echo "$tfVars" >> variables.tf
echo "$backendTfVars" >> backend.tfvars
echo "$tfTemplate" >> main.tf
file_we_expect=("variables.tf" "main.tf" "backend.tfvars")
validate_directory "$TEST_WORKSPACE/$terraform_template_dir/template" "${file_we_expect[@]}" >> $TEST_WORKSPACE/log.txt
# The TF Template requires a git release for a version to be targeted for spk scaffold
git add -A

# See if the remote repo exists
repo_exists $AZDO_ORG_URL $AZDO_PROJECT $terraform_template_dir

# Create the remote repo for the local repo
created_repo_result=$(az repos create --name "$terraform_template_dir" --org $AZDO_ORG_URL --p $AZDO_PROJECT) >> $TEST_WORKSPACE/log.txt

# Extract out remote repo URL from the above result
remote_repo_url=$(echo $created_repo_result | jq '.remoteUrl' | tr -d '"' )
echo "The remote_repo_url is $remote_repo_url"

# Remove the user from the URL
repo_url=$(getHostandPath "$remote_repo_url")

git commit -m "inital commit"
git tag "$tf_template_version"

# git remote rm origin
source=https://infra_account:$ACCESS_TOKEN_SECRET@$repo_url
git remote add origin "$source"
echo "git push"
git push -u origin --all
git push origin "$tf_template_version"


# Scaffold an Infra-HLD repo from TF Template ------------------
cd ../..
# Single Cluster scaffold for template
pwd
echo "../$terraform_template_dir"
echo "$tf_template_version"
spk infra scaffold -n $infra_hld_dir --source "$source" --version "$tf_template_version" --template "template" >> $TEST_WORKSPACE/log.txt
# Validate the definition in the Infra-HLD repo ------------------
file_we_expect=("definition.yaml")
validate_directory "$TEST_WORKSPACE/$infra_hld_dir" "${file_we_expect[@]}"
# Validate the contents of the definition.yaml
validate_file "$TEST_WORKSPACE/$infra_hld_dir/definition.yaml" $validation_test_yaml >> $TEST_WORKSPACE/log.txt

# Generate TF Files from Infra HLDs ------------------
cd $infra_hld_dir
spk infra generate

# Verify that the Terraform files generation was successful
# Confirm that generated directory created, spk.tfvars created, and tf templates copied
generated_directory="$TEST_WORKSPACE/$infra_hld_dir-generated"
file_we_expect=("spk.tfvars" "main.tf" "variables.tf" "backend.tfvars")
validate_directory "$generated_directory" "${file_we_expect[@]}"

# Confirm contents of the spk.tfvars file are correct
validate_file "$generated_directory/spk.tfvars" 'rg_name = "<insert value>"'
validate_file "$generated_directory/backend.tfvars" 'storage_account_name = "<storage account name>"'
