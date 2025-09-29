declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: unknown;
  }

  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string,
    options?: Record<string, unknown>
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string,
    options?: Record<string, unknown>
  ): JwtPayload | string;

  export function decode(
    token: string,
    options?: Record<string, unknown>
  ): null | JwtPayload | string;

  const _default: {
    sign: typeof sign;
    verify: typeof verify;
    decode: typeof decode;
  };

  export default _default;
}
