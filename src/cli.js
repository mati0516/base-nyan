#!/usr/bin/env node
/** base-nyan のコマンドライン。標準入力からも読める。 */
import { readFileSync } from "node:fs";
import { encode, decode, MEOWS, SPEC, symbolLength, BaseNyanError } from "./base-nyan.js";

const USAGE = `base-nyan — 猫の鳴き声でバイナリを書く

  base-nyan encode [text]        文字列を鳴き声の並びにする
  base-nyan decode [text]        鳴き声の並びを文字列に戻す
  base-nyan table                32の鳴き声と桁の値を並べる

  -f, --file <path>   入力をファイルから読む（バイナリ可）
  -s, --sep <str>     encode 時の区切り（既定は無し）
      --raw           decode の結果を生バイトのまま出す
  -h, --help

引数を省くと標準入力から読む。

  $ echo -n "さくら" | base-nyan encode
  $ base-nyan decode にゃにゃんなーにゃー…
  $ base-nyan encode -f photo.png --sep ' ' > photo.txt
`;

const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
  process.stdout.write(USAGE);
  process.exit(argv.length === 0 ? 1 : 0);
}

const cmd = argv.shift();
const opts = { file: null, sep: "", raw: false };
const rest = [];
while (argv.length) {
  const a = argv.shift();
  if (a === "-f" || a === "--file") opts.file = argv.shift();
  else if (a === "-s" || a === "--sep") opts.sep = argv.shift() ?? "";
  else if (a === "--raw") opts.raw = true;
  else rest.push(a);
}

try {
  if (cmd === "table") {
    for (const [i, name] of MEOWS.entries()) {
      process.stdout.write(`${String(i).padStart(2)}  ${name}\n`);
    }
    process.stdout.write(
      `\n${SPEC.blockBytes}バイト = ${SPEC.blockSymbols}鳴き声` +
      `（1鳴き声あたり ${SPEC.bitsPerSymbol.toFixed(4)} bit / 理論上限 ${Math.log2(32).toFixed(4)} bit）\n`
    );
    process.exit(0);
  }

  const input = opts.file
    ? readFileSync(opts.file)
    : rest.length
      ? Buffer.from(rest.join(" "), "utf8")
      : readFileSync(0);

  if (cmd === "encode") {
    const bytes = new Uint8Array(input);
    process.stdout.write(encode(bytes, { separator: opts.sep }) + "\n");
    process.stderr.write(`${bytes.length}バイト → ${symbolLength(bytes.length)}鳴き声\n`);
  } else if (cmd === "decode") {
    const out = decode(input.toString("utf8").trim());
    if (opts.raw) process.stdout.write(Buffer.from(out));
    else process.stdout.write(Buffer.from(out).toString("utf8") + "\n");
  } else {
    process.stderr.write(`知らないコマンド: ${cmd}\n\n${USAGE}`);
    process.exit(1);
  }
} catch (err) {
  process.stderr.write(`${err instanceof BaseNyanError ? "base-nyan: " : ""}${err.message}\n`);
  process.exit(1);
}
