import { Command } from "../command";
import { create } from "./create";

export const ingressCommand = Command(
  "ingress-route",
  "Create and manage Traefik IngressRoutes for a Bedrock project.",
  [create]
);
