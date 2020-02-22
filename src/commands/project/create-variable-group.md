## Description

Create new variable group in Azure DevOps project

## Command Prerequisites

In addition to an existing
[Azure DevOps project](https://azure.microsoft.com/en-us/services/devops/), to
link secrets from an Azure key vault as variables in Variable Group, you will
need an existing key vault containing your secrets and the Service Principal for
authorization with Azure Key Vault.

1. Use existng or
   [create a service principal either in Azure Portal](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal)
   or
   [with Azure CLI](https://docs.microsoft.com/en-us/cli/azure/create-an-azure-service-principal-azure-cli?view=azure-cli-latest).
2. Use existing or
   [create a Azure Container Registry in Azure Portal](https://docs.microsoft.com/en-us/azure/container-registry/container-registry-get-started-portal)
   or
   [with Azure CLI](https://docs.microsoft.com/en-us/azure/container-registry/container-registry-get-started-azure-cli).
