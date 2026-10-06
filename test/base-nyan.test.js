import test from "node:test";
import assert from "node:assert/strict";
import {
  MEOWS, encode, encodeText, decode, decodeText,
  symbolLength, SPEC, BaseNyanError,
} from "../src/base-nyan.js";

/** 再現できる擬似乱数（テストが日によって違う顔をしないように）。 */
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s >>> 24;
  };
}

test("アルファベットは鳴き声32種ちょうどで、重複がない", () => {
  assert.equal(MEOWS.length, 32);
  assert.equal(new Set(MEOWS).size, 32);
});

test("どの鳴き声も他の鳴き声の接頭辞になっていない（区切り無しで一意に読める根拠）", () => {
  for (const a of MEOWS) {
    for (const b of MEOWS) {
      if (a !== b) assert.ok(!b.startsWith(a), `${a} は ${b} の接頭辞になっている`);
    }
  }
});

test("鳴き声はカタカナと長音だけで出来ていて、区切りとして読み飛ばす文字を含まない", () => {
  for (const m of MEOWS) assert.match(m, /^[ァ-ヶー]+$/u, m);
});

test("空の入力は空の出力になり、往復する", () => {
  assert.equal(encode(new Uint8Array(0)), "");
  assert.deepEqual(decode(""), new Uint8Array(0));
});

test("0〜255 の1バイトすべてが往復する", () => {
  for (let b = 0; b <= 255; b++) {
    const encoded = encode(Uint8Array.of(b));
    assert.equal(encoded.length > 0, true);
    assert.deepEqual(decode(encoded), Uint8Array.of(b), `byte ${b}`);
  }
});

test("0〜80バイトの任意のバイト列が往復する（端数ブロックを全部踏む）", () => {
  const rand = prng(20261006);
  for (let len = 0; len <= 80; len++) {
    for (let trial = 0; trial < 8; trial++) {
      const bytes = Uint8Array.from({ length: len }, () => rand());
      assert.deepEqual(decode(encode(bytes)), bytes, `len=${len} trial=${trial}`);
    }
  }
});

test("全部 0xff・全部 0x00 のブロックが往復する（40 bit の両端）", () => {
  for (let len = 1; len <= 15; len++) {
    for (const fill of [0, 255]) {
      const b = new Uint8Array(len).fill(fill);
      assert.deepEqual(decode(encode(b)), b, `len=${len} fill=${fill}`);
    }
  }
});

test("先頭のゼロバイトが失われない", () => {
  for (const bytes of [[0], [0, 0], [0, 0, 0, 1], [0, 255, 0], new Array(5).fill(0)]) {
    const b = Uint8Array.from(bytes);
    assert.deepEqual(decode(encode(b)), b, JSON.stringify(bytes));
  }
});

test("symbolLength が実際の鳴き声の数と一致する", () => {
  const rand = prng(7);
  for (let len = 0; len <= 60; len++) {
    const bytes = Uint8Array.from({ length: len }, () => rand());
    const count = countMeows(encode(bytes));
    assert.equal(count, symbolLength(len), `len=${len}`);
  }
});

test("区切り文字は在っても無くても同じものとして読める", () => {
  const bytes = Uint8Array.from({ length: 23 }, (_, i) => i * 7 % 256);
  const plain = encode(bytes);
  for (const sep of ["", " ", "、", "！", "♪", "\n", "・", "　", "〜"]) {
    assert.deepEqual(decode(encode(bytes, { separator: sep })), bytes, `sep=${JSON.stringify(sep)}`);
  }
  assert.equal(encode(bytes, { separator: "、" }).replaceAll("、", ""), plain);
});

test("ひらがなで書いてもカタカナと同じに読める", () => {
  const plain = encodeText("さくら");
  const hira = plain.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  assert.notEqual(hira, plain);
  assert.equal(decodeText(hira), "さくら");
});

test("日本語・絵文字を含む文字列が UTF-8 で往復する", () => {
  for (const text of ["さくら", "日本語", "Hello, world!", "🐈🐾", "", "改行\nと\tタブ"]) {
    assert.equal(decodeText(encodeText(text)), text, text);
  }
});

test("5バイトはちょうど8鳴き声になる（満杯ブロック）", () => {
  assert.equal(SPEC.blockBytes, 5);
  assert.equal(SPEC.blockSymbols, 8);
  assert.equal(countMeows(encode(new Uint8Array(5))), 8);
  assert.equal(countMeows(encode(new Uint8Array(10))), 16);
});

test("鳴き声でない文字は位置つきで撥ねる", () => {
  assert.throws(() => decode("ニャーワン"), (e) => e instanceof BaseNyanError && e.position === 3);
  assert.throws(() => decode("ニャ"), BaseNyanError);
});

test("あり得ない長さ（末尾1回・3回・6回）は撥ねる", () => {
  for (const n of [1, 3, 6, 9]) {
    const text = MEOWS.slice(0, n).map(() => MEOWS[0]).join("");
    assert.throws(() => decode(text), BaseNyanError, `${n}回`);
  }
});

test("表せる範囲を超えた並びは撥ねる（base-nyan が作らない並び）", () => {
  // 2鳴き声 = 1バイト。値が 256 以上になる並びは符号化器からは出てこない。
  assert.throws(() => decode(MEOWS[8] + MEOWS[0]), BaseNyanError);
  // 境界のすぐ内側は通る。
  assert.deepEqual(decode(MEOWS[7] + MEOWS[31]), Uint8Array.of(7 * 32 + 31)); // 255＝表せる最大
});

test("符号化の出力は鳴き声だけで出来ている", () => {
  const rand = prng(99);
  const bytes = Uint8Array.from({ length: 64 }, () => rand());
  let rest = encode(bytes);
  while (rest.length > 0) {
    const hit = MEOWS.find((p) => rest.startsWith(p));
    assert.ok(hit, `読めない断片: ${rest.slice(0, 6)}`);
    rest = rest.slice(hit.length);
  }
});

test("1鳴き声あたりの情報量が理論上限ちょうど（5 bit）", () => {
  assert.equal(SPEC.bitsPerSymbol, Math.log2(32));
});

function countMeows(text) {
  let n = 0, i = 0;
  while (i < text.length) {
    const hit = MEOWS.find((p) => text.startsWith(p, i));
    if (!hit) throw new Error(`読めない: ${text.slice(i, i + 6)}`);
    i += hit.length; n++;
  }
  return n;
}
