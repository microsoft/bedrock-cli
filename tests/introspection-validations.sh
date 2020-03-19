#!/bin/bash

#Fail on first error
set -e

. ./functions.sh

# To-do: DOCUMENTATION

TEST_WORKSPACE="$(pwd)/spk-env"
[ ! -z "$SPK_LOCATION" ] || { echo "Provide SPK_LOCATION"; exit 1;}
[ ! -z "$ACCESS_TOKEN_SECRET" ] || { echo "Provide ACCESS_TOKEN_SECRET"; exit 1;}
[ ! -z "$AZDO_PROJECT" ] || { echo "Provide AZDO_PROJECT"; exit 1;}
[ ! -z "$AZ_RESOURCE_GROUP" ] || { echo "Provide AZ_RESOURCE_GROUP"; exit 1;}
[ ! -z "$AZDO_ORG" ] || { echo "Provide AZDO_ORG"; exit 1;}
[ ! -z "$ACR_NAME" ] || { echo "Provide ACR_NAME"; exit 1;}
[ ! -z "$SP_APP_ID" ] || { echo "Provide SP_APP_ID"; exit 1;}
[ ! -z "$SP_PASS" ] || { echo "Provide SP_PASS"; exit 1;}
[ ! -z "$SP_TENANT" ] || { echo "Provide SP_TENANT"; exit 1;}
[ ! -z "$AZ_STORAGE_ACCOUNT" ] || { echo "Provide AZ_STORAGE_ACCOUNT"; exit 1;}
AZDO_ORG_URL="${AZDO_ORG_URL:-"https://dev.azure.com/$AZDO_ORG"}"

echo "TEST_WORKSPACE: $TEST_WORKSPACE"
echo "SPK_LOCATION: $SPK_LOCATION"
echo "AZDO_PROJECT: $AZDO_PROJECT"
echo "AZDO_ORG: $AZDO_ORG"
echo "AZDO_ORG_URL: $AZDO_ORG_URL"
echo "AZ_RESOURCE_GROUP: $AZ_RESOURCE_GROUP"
echo "ACR_NAME: $ACR_NAME"
echo "AZ_STORAGE_ACCOUNT: $AZ_STORAGE_ACCOUNT"

vg_name=fabrikam-intro-vg
sa_location=westus
kv_name=fabrikamkv
kv_location=westus

# Introspection Storage Account Setup
sa_partition_key="integration-test"

branchName=myFeatureBranch
FrontEnd=fabrikam.acme.frontend
BackEnd=fabrikam.acme.backend
hld_dir=fabrikam-intro-hld
manifests_dir=fabrikam-manifests
vg_name=fabrikam-intro-vg
services_dir=services
mono_repo_dir=fabrikamintro2019
services_full_dir="$TEST_WORKSPACE/$mono_repo_dir/$services_dir"

shopt -s expand_aliases
alias spk=$SPK_LOCATION
echo "SPK Version: $(spk --version)"
echo "Running from $(pwd)"

echo "Running from $(pwd)"
if [ -d "$TEST_WORKSPACE"  ]; then rm -Rf $TEST_WORKSPACE; fi

if [ ! -d "$TEST_WORKSPACE" ]; then
  echo "Directory '$TEST_WORKSPACE' does not exist"
  mkdir $TEST_WORKSPACE
  echo "Created '$TEST_WORKSPACE'"
fi

cd $TEST_WORKSPACE

# spk deployment onboard validation test
sat_onboard_name='spktest'$RANDOM
subscription_id=$(az account list | jq '.[] | select(.isDefault == true) | .id' -r)
storage_account_exists $AZ_STORAGE_ACCOUNT $AZ_RESOURCE_GROUP "fail"

spk deployment onboard -s $AZ_STORAGE_ACCOUNT -t $sat_onboard_name -l $sa_location -r $AZ_RESOURCE_GROUP --subscription-id $subscription_id --service-principal-id $SP_APP_ID --service-principal-password $SP_PASS --tenant-id $SP_TENANT
storage_account_table_exists $sat_onboard_name $AZ_STORAGE_ACCOUNT "fail"

echo "Successfully validated spk deployment onboard."
