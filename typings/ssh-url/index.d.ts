declare module "ssh-url" {
  export interface SshUrlObj {
    protocol: null | string;
    user: string;
    hostname: string;
    pathname: string;
  }

  export function parse(gitSshUrl: string): SshUrlObj;
  export function format(sshUrlObj: SshUrlObj): string;
}
