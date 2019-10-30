import commander from "commander";
import { writeFileSync } from "fs";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import shelljs from "shelljs";
import { TraefikIngressRoute } from "../../lib/traefik/ingress-route";
import { logger } from "../../logger";

export const create = (command: commander.Command): void => {
  command
    .command("create <service> <port>")
    .alias("c")
    .description("Create a Traefik IngressRoute for a target <service>:<port>")
    .option(
      "-r, --ring <ring>",
      "the ring to deploy this service to, if provided the generated IngressRoute will target service `<service>-<ring>`",
      ""
    )
    .option(
      "--entry-point <entry-point>",
      "the Traefik IngressRoute entryPoint; can be either 'web' or 'web-secure'; defaults to allowing all traffic if left blank",
      ""
    )
    .option(
      "--namespace <namespace>",
      "a namespace to inject into the outputted Kubernetes manifest",
      ""
    )
    .option(
      "-o, --output-file <filepath>",
      "filepath to output the IngressRoute YAML to; defaults to outputting to stdout",
      ""
    )
    .action(
      async (service, port, { ring, entryPoint, namespace, outputFile }) => {
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

          // create the route
          const ingressRoute = TraefikIngressRoute(service, ring, portAsNum, {
            entryPoints: [entryPoint].filter(entry => entry !== ""),
            namespace
          });
          const routeYaml = yaml.safeDump(ingressRoute, {
            lineWidth: Number.MAX_SAFE_INTEGER
          });

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

            // Write out the YAML
            logger.info(`Writing IngressRule YAML to ${outputPath}`);
            writeFileSync(outputPath, routeYaml);
            logger.info(`Successfully wrote IngressRule YAML to ${outputPath}`);
          } else {
            // log to stdout by default
            // tslint:disable-next-line: no-console
            console.log(routeYaml);
          }
        } catch (err) {
          logger.error(err);
          process.exitCode = 1;
        }
      }
    );
};
