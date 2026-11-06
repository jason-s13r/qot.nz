---
title: Fuse 0xAC
name: "FUSE <span class=\"hex\">0xAC</span>"
order: 6
card: "fuse"
tone: tone-fuse
fonts: ["VT323","JetBrains+Mono:wght@400;700"]
chips: ["Puzzle","Numbers"]
host: fuse.qot.nz
lastmod: 2026-10-30
description: "Fuse 0xAC is a free browser puzzle game about guarding one number: inspect packets, decode hex, octal and binary, and spot the forgeries. How it plays, the five days and endless mode."
lede: "One number. Keep it locked. Address 0xAC holds 172: check every packet that wants to change it, and spot the forgeries before the fuse breaks."
short: "One number, one checkpoint. Spot the forged packets before 172 becomes 173."
screenshot:
  file: fuse.jpg
  width: 800
  height: 449
  alt: "Fuse 0xAC in play: packet 0002 from kumara_hax asks to write 173 to address 0xAC with no signature, next to the Accept and Reject buttons and the rulebook."
  caption: "Day 1: an unsigned packet wants to write 173 to 0xAC. That one gets rejected."
---

A puzzle game about guarding one number. Address 0xAC holds 172, and everyone wants it changed. Inspect each incoming packet, decode the hex, check the signatures and spot the forgeries. Let three bad packets through and the fuse breaks.

<!--more-->

## What it is

Fuse 0xAC is a short puzzle game about guarding one number. Memory address 0xAC holds the value 172, and it always has. You run the checkpoint in front of it. Packets arrive one at a time asking to read memory, write to it, file a report or use the bus, and you decide which ones get through. Most are honest. Some are trying to change that 172, and they won’t say so.

It runs in your web browser with nothing to install and no account.

## How it plays

Read each packet: who sent it, what it wants to do, which address, what value, and whether it’s signed. Check it against the rulebook, then **accept** it or **reject** it. When you reject a packet, you also pick the rule it broke.

- Accepting an honest packet earns points. Rejecting an honest one costs a citation and a few points.
- Rejecting a hostile packet for the right reason earns full points. The right call for the wrong reason earns some.
- Correct calls in a row build a combo, up to ×4.
- From day 2 you get one honeypot per shift. Use it on a clearly hostile packet for bonus points, but using it on an honest one costs you.

## Keep it locked

Every hostile packet you let through damages the fuse. Let three through and it breaks, and 0xAC reads 173.

## The week

The game runs over five working days. Each day adds new rules, marked in the rulebook, so you learn as you go:

1. **Orientation:** the memory map (userland, kernel space and the fuse), hex and decimal.
2. **Notation:** octal and binary, text that only looks like a number, and a decoder tab.
3. **Evidence:** reports, screenshots and quotes. Check authors’ keys in the dossier and compare hashes.
4. **Signatures:** issuers, expiry dates, revoked serials and look-alike names. The terminal starts misbehaving, too.
5. **The Bus:** direct memory access requests that cover whole ranges, and one very convincing override.

Finish the week to unlock **Endless mode**: every rule switched on, a new grant code each shift, and packets until the fuse breaks.

## Numbers in disguise

Underneath the spy story, Fuse is about number bases. The same value can be written in hexadecimal, octal, binary or decimal (0xAC, 0254, 10101100 and 172 are all the same number), and a string of text can look like a number without being one. Spotting that is how you catch the forgeries.

## Controls

Click the buttons, or use the keyboard: **A** accepts, **R** rejects, the number keys pick a reason, **H** uses the honeypot and **Esc** cancels.

## Saving and privacy

Your progress (the furthest day you’ve reached, your best scores and whether sound is on) is saved in your browser on your own device. The game may show a Google ad. More detail is on the [Fuse 0xAC privacy page](https://fuse.qot.nz/privacy/).
