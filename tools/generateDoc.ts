import fs from "fs";
import path from "path";
import { CommandBuildElements } from "../src/lib/commandBuilder";

interface Command {
  command: string;
  subcommands: CommandBuildElements[];
}

interface CommandElement extends CommandBuildElements {
  markdown?: string;
}

// get all the *.json under commands folder recursively.
// and get the content of its corresponding md file (if any).
// add this content into the json file
const getAllDecorators = (curDir: string): CommandBuildElements[] => {
  const allFiles = fs.readdirSync(curDir);
  const jsonFiles = allFiles.filter((f) => f.endsWith(".json"));
  const arrJson: CommandElement[] = [];
  jsonFiles.forEach((fileName) => {
    const json = require(path.join(curDir, fileName)) as CommandElement;
    if (!json.disabled) {
      const mdPath = path.join(
        curDir,
        fileName.replace(/decorator\.json$/, "md")
      );
      if (fs.existsSync(mdPath)) {
        json.markdown = fs.readFileSync(mdPath, "utf8");
      }
      arrJson.push(json);
    }
  });
  return arrJson;
};

// get sub folders under commands folder.
const getSubDirectories = (curDir: string): string[] => {
  return fs
    .readdirSync(curDir)
    .map((f) => path.join(curDir, f))
    .filter((p) => fs.lstatSync(p).isDirectory());
};

// get the list of command from the array of
// command object. e.g `spk infra generate` and
// `spk deployment dashboard`
const listCommands = (
  allCommands: Command[]
): { [key: string]: CommandBuildElements } => {
  const mainCommands: { [key: string]: CommandBuildElements } = {};
  allCommands.forEach((cmd) => {
    let level1 = cmd.command;
    if (level1 === "commands") {
      level1 = "";
    } else {
      level1 = level1 + " ";
    }
    cmd.subcommands.forEach((c) => {
      const key = `${level1}${c.command.replace(/ .+/, "")}`;
      mainCommands[key] = c;
    });
  });
  return mainCommands;
};

const dir = path.join(process.cwd(), "src", "commands");
const commandDirs = getSubDirectories(dir);
commandDirs.unshift(dir); // this is needed because `spk init` is outside `commands` folder

const commands: Command[] = commandDirs
  .map((d) => {
    return {
      command: path.basename(d),
      subcommands: getAllDecorators(d),
    };
  })
  .filter((item) => item.subcommands.length > 0);

const mapCommands = listCommands(commands);

fs.writeFileSync(
  path.join(process.cwd(), "docs", "commands", "data.json"),
  JSON.stringify(mapCommands, null, 2)
);
