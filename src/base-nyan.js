/**
 * base-nyan — 猫の鳴き声 32 種をアルファベットに使うバイナリ→テキスト符号化。
 *
 * Base32 が A〜Z と 2〜7 を使うところを、base-nyan は 32 の鳴き声を「数字」として使う。
 *
 *   encode("さくら") -> "ゴロンニャッミャアンーウニャ…"
 *
 * 依存なし・素の ES モジュール。ブラウザでも Node でもそのまま動く。
 * @module base-nyan
 */

/** 添字がそのまま 32 進数の桁の値（ニャー=0 … ンー=31）。 */
export const MEOWS = Object.freeze([
  "ニャー", "ニャン", "ニャア", "ニャッ", "ニャオ", "ニャウ", "ミャー", "ミャン",
  "ミャア", "ミャッ", "ミャオ", "ミャウ", "ナーオ", "ナーゴ", "ンナー", "ンニャ",
  "ウニャ", "ムニャ", "ミー", "ミュー", "ゴロゴロ", "グルル", "シャー", "フー",
  "フシャ", "カカカ", "ケケケ", "プルル", "ニャニャ", "ミャミャ", "ゴロン", "ンー",
]);

/** 鳴き声 → 桁の値(0..31) */
const VALUE_OF = new Map(MEOWS.map((name, i) => [name, i]));

/** 長い鳴き声から順に試す（接頭符号なので順は結果を変えない。無駄打ちを減らすだけ）。 */
const WIDTHS = [...new Set(MEOWS.map((m) => m.length))].sort((a, b) => b - a);

/** 満杯のブロック＝5バイトを8鳴き声で表す（5 bit/鳴き声＝理論値の100%）。 */
const BLOCK_BYTES = 5;
const BLOCK_SYMBOLS = 8;

/** 端数ブロック: kバイト → m鳴き声（m = 32^m >= 256^k となる最小のm）。 */
const SYMBOLS_FOR_BYTES = [0, 2, 4, 5, 7, 8];

/** その逆引き。ここに無い鳴き声の数は、あり得ない長さ＝壊れた入力。 */
const BYTES_FOR_SYMBOLS = new Map(
  SYMBOLS_FOR_BYTES.map((m, k) => [m, k]).filter(([m]) => m > 0)
);

/**
 * デコード時に読み飛ばす区切り（区切りは飾りであって情報ではない）。
 * 長音「ー」は鳴き声の一部なので、base47 と違ってここには入れない。
 */
const IGNORABLE = /[\s　・･,、，。.!！?？♪〜～\/／|｜\-－_]+/gu;

const BASE = 32;

export class BaseNyanError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "BaseNyanError";
    Object.assign(this, details);
  }
}

/* ------------------------------------------------------------------ */
/* encode                                                              */
/* ------------------------------------------------------------------ */

/**
 * バイト列または文字列を鳴き声の並びにする。
 *
 * @param {string|Uint8Array|ArrayBuffer|number[]} input
 *        文字列を渡した場合は UTF-8 のバイト列として扱う。
 * @param {{separator?: string}} [options]
 *        separator: 鳴き声のあいだに挟む文字（既定は空＝連結）。
 *        区切りは読みやすさのためだけのもので、無くてもデコードできる。
 * @returns {string}
 */
export function encode(input, options = {}) {
  const { separator = "" } = options;
  const bytes = toBytes(input);
  const out = [];

  for (let offset = 0; offset < bytes.length; offset += BLOCK_BYTES) {
    const k = Math.min(BLOCK_BYTES, bytes.length - offset);
    const m = SYMBOLS_FOR_BYTES[k];

    // 最大 40 bit なので Number で正確に扱える（2^53 未満）。
    let value = 0;
    for (let i = 0; i < k; i++) value = value * 256 + bytes[offset + i];

    // 大きい桁が先（ビッグエンディアン）。
    const digits = new Array(m);
    for (let i = m - 1; i >= 0; i--) {
      digits[i] = MEOWS[value % BASE];
      value = Math.floor(value / BASE);
    }
    out.push(...digits);
  }

  return out.join(separator);
}

/** 文字列を UTF-8 として符号化する（encode の別名。意図をはっきりさせたい時に）。 */
export function encodeText(text, options = {}) {
  return encode(new TextEncoder().encode(String(text)), options);
}

/* ------------------------------------------------------------------ */
/* decode                                                              */
/* ------------------------------------------------------------------ */

/**
 * 鳴き声の並びをバイト列に戻す。
 *
 * 区切り文字（空白・読点・「！」「♪」等）は在っても無くてもよい。
 * ひらがなで書かれていてもカタカナとして読む（「にゃー」＝「ニャー」）。
 * 32 の鳴き声は互いに接頭辞にならないため、区切り無しでも一意に読める。
 *
 * @param {string} text
 * @returns {Uint8Array}
 */
export function decode(text) {
  const src = toKatakana(String(text)).replace(IGNORABLE, "");
  const digits = [];

  let i = 0;
  while (i < src.length) {
    let value, width;
    for (const w of WIDTHS) {
      value = VALUE_OF.get(src.slice(i, i + w));
      if (value !== undefined) { width = w; break; }
    }
    if (value === undefined) {
      throw new BaseNyanError(
        `${i}文字目「${src.slice(i, i + 4)}」は鳴き声として読めません。`,
        { position: i, fragment: src.slice(i, i + 4) }
      );
    }
    digits.push(value);
    i += width;
  }

  const blocks = Math.ceil(digits.length / BLOCK_SYMBOLS) || 0;
  const tail = digits.length - (blocks - 1) * BLOCK_SYMBOLS;
  if (blocks > 0 && !BYTES_FOR_SYMBOLS.has(tail)) {
    throw new BaseNyanError(
      `鳴き声が ${digits.length} 回では長さが合いません（末尾のまとまりが ${tail} 回）。` +
        `末尾は ${[...BYTES_FOR_SYMBOLS.keys()].join("/")} 回のいずれかである必要があります。`,
      { symbols: digits.length, tail }
    );
  }

  const out = [];
  for (let b = 0; b < blocks; b++) {
    const chunk = digits.slice(b * BLOCK_SYMBOLS, (b + 1) * BLOCK_SYMBOLS);
    const k = BYTES_FOR_SYMBOLS.get(chunk.length);

    let value = 0;
    for (const d of chunk) value = value * BASE + d;

    // 32^m は 256^k 以上なので、上振れした並びは「作れないはずの値」＝壊れた入力。
    if (value >= 2 ** (8 * k)) {
      throw new BaseNyanError(
        `${b + 1}番目のまとまりが表せる範囲を超えています（この鳴き声の並びは base-nyan では作られません）。`,
        { block: b + 1 }
      );
    }

    const bytes = new Array(k);
    for (let j = k - 1; j >= 0; j--) {
      bytes[j] = value % 256;
      value = Math.floor(value / 256);
    }
    out.push(...bytes);
  }

  return Uint8Array.from(out);
}

/** 鳴き声の並びを UTF-8 文字列に戻す。 */
export function decodeText(text) {
  return new TextDecoder("utf-8", { fatal: false }).decode(decode(text));
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** ひらがな（ぁ〜ゖ）をカタカナに寄せる。「ー」などはそのまま。 */
function toKatakana(s) {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

function toBytes(input) {
  if (typeof input === "string") return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (Array.isArray(input)) {
    for (const b of input) {
      if (!Number.isInteger(b) || b < 0 || b > 255) {
        throw new BaseNyanError(`バイト列に 0〜255 でない値が含まれています: ${b}`);
      }
    }
    return Uint8Array.from(input);
  }
  throw new BaseNyanError("encode には文字列かバイト列を渡してください。");
}

/** nバイトが何鳴き声になるか（実際に符号化せずに数えたい時に）。 */
export function symbolLength(byteLength) {
  const full = Math.floor(byteLength / BLOCK_BYTES);
  const rest = byteLength % BLOCK_BYTES;
  return full * BLOCK_SYMBOLS + SYMBOLS_FOR_BYTES[rest];
}

export const SPEC = Object.freeze({
  base: 32,
  blockBytes: BLOCK_BYTES,
  blockSymbols: BLOCK_SYMBOLS,
  symbolsForBytes: Object.freeze([...SYMBOLS_FOR_BYTES]),
  bitsPerSymbol: (BLOCK_BYTES * 8) / BLOCK_SYMBOLS,
});

export default { MEOWS, encode, encodeText, decode, decodeText, symbolLength, SPEC, BaseNyanError };
