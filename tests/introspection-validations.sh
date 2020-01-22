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
AZDO_ORG_URL="${AZDO_ORG_URL:-"https://dev.azure.com/$AZDO_ORG"}"

echo "TEST_WORKSPACE: $TEST_WORKSPACE"
echo "SPK_LOCATION: $SPK_LOCATION"
echo "AZDO_PROJECT: $AZDO_PROJECT"
echo "AZDO_ORG: $AZDO_ORG"
echo "AZDO_ORG_URL: $AZDO_ORG_URL"
echo "AZ_RESOURCE_GROUP: $AZ_RESOURCE_GROUP"
echo "ACR_NAME: $ACR_NAME"

vg_name=fabrikam-vg
sa_name=fabrikamsatst
sat_name=fabrikamdeployments
sa_location=westus
kv_name=fabrikamkv
kv_location=westus

shopt -s expand_aliases
alias spk=$SPK_LOCATION
echo "SPK Version: $(spk --version)"
echo "Running from $(pwd)"

# spk deployment onboard validation test
storage_account_exists $sa_name $AZ_RESOURCE_GROUP "delete"
spk deployment onboard -s $sa_name -t $sat_name -l $sa_location -r $AZ_RESOURCE_GROUP --subscription-id $AZ_SUBSCRIPTION_ID --service-principal-id $SP_APP_ID --service-principal-password $SP_PASS --tenant-id $SP_TENANT
storage_account_exists $sa_name $AZ_RESOURCE_GROUP "fail"
storage_account_table_exists $sat_name $sa_name "fail"

echo "Successfully reached the end of the introspection validations script."
