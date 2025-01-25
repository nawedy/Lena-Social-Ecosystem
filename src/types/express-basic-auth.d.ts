declare module 'express-basic-auth' {
  import { RequestHandler } from 'express';

  interface BasicAuthOptions {
    users?: { [key: string]: string } | null;
    challenge?: boolean;
    realm?: string;
    authorizer?: (
      username: string,
      password: string,
      req?: any
    ) => boolean | Promise<boolean>;
    authorizeAsync?: boolean;
    unauthorizedResponse?: ((req: any) => any) | any;
  }

  function basicAuth(options: BasicAuthOptions): RequestHandler;
  export = basicAuth;
}
