import fs from "fs";
import path from "path";
import { CommandBuildElements } from "../src/lib/commandBuilder";

interface ICommandElement extends CommandBuildElements {
  markdown?: string;
}

// get all the *.json under commands folder recursively.
// and get the content of its corresponding md file (if any).
// add this content into the json file
const getAllDecorators = (curDir: string): CommandBuildElements[] => {
  const allFiles = fs.readdirSync(curDir);
  const jsonFiles = allFiles.filter(f => f.endsWith(".json"));
  const arrJson: ICommandElement[] = [];
  jsonFiles.forEach(fileName => {
    const json = require(path.join(curDir, fileName)) as ICommandElement;
    arrJson.push(json);
  });
  return arrJson;
};

// get sub folders under commands folder.
const getSubDirectories = (curDir: string): string[] => {
  return fs
    .readdirSync(curDir)
    .map(f => path.join(curDir, f))
    .filter(p => fs.lstatSync(p).isDirectory());
};

const consolidateAliases = (
  allCommands: CommandBuildElements[]
): { [key: string]: string[] } => {
  const mainCommands: { [key: string]: string[] } = {};
  allCommands.forEach(cmd => {
    cmd.options
      ?.map(o => o.arg)
      .forEach(ar => {
        if (!ar.startsWith("--")) {
          const parts = ar.replace(/,/, "").split(" ");
          const alias = parts[0].substring(1);
          const opt = parts[1].substring(2);
          mainCommands[alias] = mainCommands[alias] || [];
          mainCommands[alias].push(opt);
        } else {
          const parts = ar.split(" ");
          mainCommands._ = mainCommands._ || [];
          mainCommands._.push(parts[0].substring(2));
        }
      });
  });
  return mainCommands;
};

const dir = path.join(process.cwd(), "src", "commands");
const commandDirs = getSubDirectories(dir);
commandDirs.unshift(dir); // this is needed because `spk init` is outside `commands` folder

let commands: CommandBuildElements[] = [];
commandDirs.forEach(folder => {
  commands = commands.concat(getAllDecorators(folder));
});

const aliases = consolidateAliases(commands);
Object.values(aliases).forEach(v => v.sort());

const keys = Object.keys(aliases).sort();
keys.forEach(k => {
  console.log(`${k}: ${JSON.stringify(aliases[k], null, 2)}`);
});
