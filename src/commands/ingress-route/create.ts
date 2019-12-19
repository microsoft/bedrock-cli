import commander from "commander";
import { writeFileSync } from "fs";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import shelljs from "shelljs";
import { TraefikIngressRoute } from "../../lib/traefik/ingress-route";
import { TraefikMiddleware } from "../../lib/traefik/middleware";
import { logger } from "../../logger";

export const create = (command: commander.Command): void => {
  command
    .command("create <service> <port>")
    .alias("c")
    .description("Create a Traefik IngressRoute for a target <service>:<port>")
    .option(
      "-r, --ring <ring>",
      "The ring to deploy this service to, if provided the generated IngressRoute will target service `<service>-<ring>`",
      ""
    )
    .option(
      "--entry-point <entry-point>",
      "The Traefik IngressRoute entryPoint; can be either 'web' or 'web-secure'; defaults to allowing all traffic if left blank",
      ""
    )
    .option(
      "--namespace <namespace>",
      "A namespace to inject into the outputted Kubernetes manifests",
      ""
    )
    .option(
      "-o, --output-file <filepath>",
      "The file to output the IngressRoute and Middleware YAML to, spk will attempt to create this file if it does not exist; defaults to outputting to stdout",
      ""
    )
    .option("--no-middleware", "Skip adding a strip prexfix middleware.")
    .action(
      async (
        service,
        port,
        { ring, entryPoint, namespace, outputFile, middleware }
      ) => {
        try {
          // type-check everything
          const portAsNum = Number.parseInt(port, 10);
          if (typeof portAsNum !== "number" || isNaN(portAsNum)) {
            throw Error(
              `<port> expects a base 10 parsable number, unable to convert '${port}' to a number`
            );
          }
          if (typeof service !== "string") {
            throw Error(
              `<service> expects a 'string' value, '${typeof service} provided'`
            );
          }
          if (typeof ring !== "string") {
            throw Error(
              `--ring expects a 'string' value, '${typeof ring}' provided`
            );
          }
          if (!["", "web", "web-secure"].includes(entryPoint)) {
            throw Error(
              `--entry-point expects a 'string' value of either 'web' or 'web-secure', '${entryPoint}' provided`
            );
          }
          if (typeof namespace !== "string") {
            throw Error(
              `--namespace expects a 'string' value, '${typeof namespace}' provided`
            );
          }
          if (typeof middleware !== "boolean") {
            throw Error(
              `--no-middleware expects a 'boolean' value, '${typeof middleware}' provided`
            );
          }

          let outputYaml;

          if (middleware) {
            // Create IngressRoute and Middleware
            const servicePrefix = `/${service}`;
            const middlewares = TraefikMiddleware(
              service,
              ring,
              [servicePrefix],
              { namespace }
            );
            const middlewareYaml = yaml.safeDump(middlewares, {
              lineWidth: Number.MAX_SAFE_INTEGER
            });

            const ingressRoute = TraefikIngressRoute(service, ring, portAsNum, {
              entryPoints: [entryPoint].filter(entry => entry !== ""),
              middlewares: [middlewares.metadata.name],
              namespace
            });
            const routeYaml = yaml.safeDump(ingressRoute, {
              lineWidth: Number.MAX_SAFE_INTEGER
            });

            outputYaml = routeYaml + "\n---\n" + middlewareYaml;
          } else {
            // create Ingress Route with no Middleware
            const ingressRoute = TraefikIngressRoute(service, ring, portAsNum, {
              entryPoints: [entryPoint].filter(entry => entry !== ""),
              namespace
            });
            const routeYaml = yaml.safeDump(ingressRoute, {
              lineWidth: Number.MAX_SAFE_INTEGER
            });
            outputYaml = routeYaml;
          }

          // output to file or stdout based on --output-file
          if (!!outputFile) {
            // Write out file
            if (typeof outputFile !== "string") {
              throw Error(
                `--output-file <filepath> expects a 'string', ${typeof outputFile} provided`
              );
            }

            // Ensure the parent directories exist
            const outputPath = path.resolve(outputFile);
            const outputDir = outputPath
              .split(path.sep)
              .slice(0, -1)
              .join(path.sep);
            if (!fs.existsSync(outputDir)) {
              logger.warn(
                `Output directory for ${outputFile} specified by --output-path does not exist, creating directory ${outputDir}`
              );
              const { code } = shelljs.mkdir("-p", outputDir);
              if (code !== 0) {
                throw Error(`unable to create directory ${outputDir}`);
              }
            }

            // Write out the Ingress Route YAML
            logger.info(`Writing IngressRule YAML to ${outputPath}`);
            writeFileSync(outputPath, outputYaml);
            logger.info(`Successfully wrote IngressRule YAML to ${outputPath}`);
          } else {
            // log to stdout by default
            // tslint:disable-next-line: no-console
            console.log(outputYaml);
          }
        } catch (err) {
          logger.error(err);
          process.exitCode = 1;
        }
      }
    );
};
