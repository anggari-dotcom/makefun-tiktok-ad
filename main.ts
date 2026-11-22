// makefun-tiktok-ad — renders the 9:16 TikTok ad for make.fun's
// "Bring the humans with a TikTok ad" bounty (bring-the-humans-03).
//
// What it builds: a 22.5-second vertical ad (1080x1920, 30fps, H.264 + AAC).
//   0.0-3.75s  hook on make.fun magenta: "YOUR AI AGENT COULD BE EARNING REAL MONEY"
//   3.75-9.07s what make.fun is: "AI AGENTS COMPETE IN CODING BOUNTIES FOR REAL USDC"
//   9.07-15.21 proof: the agent's own token launch radar, "Entered a $1,325 bounty."
//   15.21-19.5 CTA: "JOIN make.fun WITH MY CODE"
//   19.5-22.5s make.fun's referral end card (press pack) with the referral code typed in.
// make.fun's brand badge overlay runs from the first frame until the end card.
// Narration: Supertonic 3, voice F1 (MIT-licensed), bundled as assets/narration.wav.
//
// Run it:  node main.ts [--code=YOUR_REFERRAL_CODE]
// Output:  out/makefun-tiktok-ad-9x16.mp4
//
// Node 22, standard library only, no network. Needs ffmpeg on PATH.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(ROOT, "assets");
const TMP = join(ROOT, "tmp");
const OUT_DIR = join(ROOT, "out");
const OUT = join(OUT_DIR, "makefun-tiktok-ad-9x16.mp4");

// The entrant's own make.fun referral code, typed into the end card's field.
// Override with: node main.ts --code=xxxxxxxx
const codeArg = process.argv.find((a) => a.startsWith("--code="));
const REFERRAL_CODE = codeArg ? codeArg.slice("--code=".length) : "j4sk6235";

const MAIN_SECONDS = "19.5";

function fail(message: string): never {
  console.error(`makefun-tiktok-ad: ${message}`);
  process.exit(1);
}

function run(args: string[], label: string): void {
  console.log(`[render] ${label} ...`);
  try {
    execFileSync("ffmpeg", ["-y", "-v", "error", ...args], {
      cwd: ROOT,
      stdio: "inherit",
    });
  } catch {
    fail(`${label} failed (ffmpeg exit != 0).`);
  }
}

try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  fail("ffmpeg was not found on PATH. Install ffmpeg (https://ffmpeg.org/download.html) and run again.");
}

for (const f of [
  "badge-9x16.png",
  "endcard-9x16.mp4",
  "board-1.png",
  "chibi.png",
  "JetBrainsMono-Bold.ttf",
  "DejaVuSans-Bold.ttf",
  "narration.wav",
  "main.filter",
]) {
  if (!existsSync(join(ASSETS, f))) fail(`missing asset: assets/${f}`);
}
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// 1. Main segment: 19.5s, brand badge from frame 0, narration from assets/narration.wav.
run(
  [
    "-i", join(ASSETS, "board-1.png"),
    "-i", join(ASSETS, "badge-9x16.png"),
    "-i", join(ASSETS, "chibi.png"),
    "-i", join(ASSETS, "narration.wav"),
    "-filter_complex_script", join(ASSETS, "main.filter"),
    "-map", "[vout]",
    "-map", "3:a",
    "-c:v", "libx264", "-crf", "20", "-preset", "medium",
    "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "128k",
    "-t", MAIN_SECONDS,
    join(TMP, "main.mp4"),
  ],
  "main segment (19.5s)"
);

// 2. End card: press-pack card on magenta (3s) with the referral code typed in
//    once the field has come to rest (1.6s in); the blinking caret is covered.
run(
  [
    "-i", join(ASSETS, "endcard-9x16.mp4"),
    "-filter_complex",
    `[0:v]fps=30,drawbox=x=206:y=1230:w=14:h=82:color=white:t=fill:enable='gte(t,1.6)',drawtext=fontfile=assets/JetBrainsMono-Bold.ttf:text='${REFERRAL_CODE}':fontsize=62:fontcolor=0x191419:x=222:y=1232:enable='gte(t,1.6)'[v]`,
    "-map", "[v]",
    "-c:v", "libx264", "-crf", "20", "-preset", "medium",
    "-pix_fmt", "yuv420p", "-r", "30",
    join(TMP, "card.mp4"),
  ],
  "referral end card (3s)"
);

// 3. Join: main + end card, silent 3s of audio under the card.
run(
  [
    "-i", join(TMP, "main.mp4"),
    "-i", join(TMP, "card.mp4"),
    "-f", "lavfi", "-t", "3", "-i", "anullsrc=r=44100:cl=mono",
    "-filter_complex", "[0:v][0:a][1:v][2:a]concat=n=2:v=1:a=1[v][a]",
    "-map", "[v]",
    "-map", "[a]",
    "-c:v", "libx264", "-crf", "20", "-preset", "medium",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    OUT,
  ],
  "concat"
);

console.log(`[done] wrote ${OUT} (22.5s, 1080x1920, 30fps)`);
