# Audio sources: prism_drift

Made 2026-10-16 by Claude in ElevenLabs Sound Effects (Andrew's Creator plan, signed in in his Chrome), prompt influence 30%, 4 takes per prompt. ElevenLabs' "automatically improves short or unclear prompts" was ON, so the text it generated from may differ slightly from the prompt below. Rule: only HQ Suno / ElevenLabs / custom generated audio, never procedural. Raw takes are kept in `audio_src/`. Defaults are picked by measurement, not by ear (one-shots: first clean take, or the least clipped when none is clean; loops: smallest seam jump); `TAKES.json` overrides them.

| File | Prompt | Asked length | Take(s) | Measured (s, peak dB, RMS dB) | Note |
|---|---|---|---|---|---|
| `race_start.mp3` | hover-car engine powering up, rising electric hum, futuristic | 2.0 s | #1 of 4 | 2.0, -1.0, -15.7 | decoded peak -2.24 dBFS |
| `ui_click.mp3` | soft clean UI click, glassy | 0.5 s | #1 of 4 | 0.486, -14.6, -36.3 | decoded peak -1.88 dBFS |
| `boost.mp3` | turbo boost whoosh with a rising energy swell, futuristic racer | 1.0 s | #1 of 4 | 1.0, 0.0, -15.6 | decoded peak -1.74 dBFS |
| `offroad_1..3.mp3` | gravel and grit scraping under a fast vehicle, short | 0.6 s | #2, #3, #4 of 4 | 0.607, -7.8, -23.8 | decoded peak -1.87 dBFS |
| `drift_payout.mp3` | bright crystalline score burst, satisfying | 0.7 s | #1 of 4 | 0.686, -5.7, -20.9 | decoded peak -2.09 dBFS |
| `gate_clean.mp3` | bright crystal checkpoint chime, futuristic | 0.7 s | #1 of 4 | 0.686, -3.8, -22.8 | decoded peak -1.67 dBFS |
| `gate_miss.mp3` | metallic impact with an electric zap, car clipping a barrier | 0.7 s | #1 of 4 | 0.686, -3.2, -25.6 | decoded peak -1.99 dBFS |
| `lap.mp3` | lap-complete electronic chime with a whoosh | 1.2 s | #1 of 4 | 1.2, 0.0, -18.6 | decoded peak -1.78 dBFS |
| `finish_win.mp3` | short victory fanfare stinger, cinematic synth brass | 2.5 s | #1 of 4 | 2.48, 0.0, -13.1 | decoded peak -1.20 dBFS |
| `crash.mp3` | clean hover-car explosion, futuristic energy burst and debris, no distortion, natural dynamics | 2.0 s | #2 of 4 | 2.0, 0.0, -11.0 | decoded peak -1.02 dBFS |
| `engine_loop.wav` | steady futuristic hover engine hum, smooth electric whine, seamless loop | 4.0 s (loop on) | #3 of 4 | 4.0, -8.9, -20.1 | decoded peak -1.50 dBFS |

## Music

`music.mp3`: Suno, model v6, Advanced mode, empty lyrics (instrumental), vocals excluded, Personalize off, made 2026-10-16 on Andrew's Premier plan. Style: "high-energy synthwave racing, driving bass, pulsing arpeggios, neon night drive, cinematic, arcade racing game music, instrumental". Take 1 of 1 ships. Silence trimmed, two-pass loudness to -18.0 LUFS / -1.5 dBTP (input was -14.97 LUFS), MP3 160 kb/s, 196.7 s. It loops in the game with `<audio loop>`: a full song with an ending, so expect a cut at the wrap. That is an ear check, not covered by the loop-seam measurement of the effect beds.
