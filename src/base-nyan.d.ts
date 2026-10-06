/** base-nyan — 猫の鳴き声 32 種をアルファベットに使うバイナリ→テキスト符号化。 */

export declare const MEOWS: readonly string[];

export interface EncodeOptions {
  /** 鳴き声のあいだに挟む区切り。既定は空（連結）。デコードには不要。 */
  separator?: string;
}

export declare class BaseNyanError extends Error {
  name: "BaseNyanError";
  position?: number;
  fragment?: string;
  symbols?: number;
  tail?: number;
  block?: number;
}

export declare function encode(
  input: string | Uint8Array | ArrayBuffer | number[],
  options?: EncodeOptions
): string;

export declare function encodeText(text: string, options?: EncodeOptions): string;
export declare function decode(text: string): Uint8Array;
export declare function decodeText(text: string): string;
export declare function symbolLength(byteLength: number): number;

export declare const SPEC: {
  readonly base: 32;
  readonly blockBytes: 5;
  readonly blockSymbols: 8;
  readonly symbolsForBytes: readonly number[];
  readonly bitsPerSymbol: number;
};

declare const _default: {
  MEOWS: typeof MEOWS;
  encode: typeof encode;
  encodeText: typeof encodeText;
  decode: typeof decode;
  decodeText: typeof decodeText;
  symbolLength: typeof symbolLength;
  SPEC: typeof SPEC;
  BaseNyanError: typeof BaseNyanError;
};
export default _default;
