declare module "ssh-url" {
  export interface ISshUrlObj {
    protocol: null | string;
    user: string;
    hostname: string;
    pathname: string;
  }

  export function parse(gitSshUrl: string): ISshUrlObj;
  export function format(sshUrlObj: ISshUrlObj): string;
}
