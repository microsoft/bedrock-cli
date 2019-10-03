import * as dotenv from "dotenv";

dotenv.config();

export const azureSubscriptionId: string = process.env.AZURE_SUBSCRIPTION_ID!;
export const azureTenantId: string = process.env.AZURE_TENANT_ID!;
export const azureClientId: string = process.env.AZURE_CLIENT_ID!;
export const azureClientSecret: string = process.env.AZURE_CLIENT_SECRET!;
