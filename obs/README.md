# OBS

## The overlays

While Sol-R Curves is running it serves one page per axis, for OBS Browser Sources:

```
http://127.0.0.1:8799/roll
http://127.0.0.1:8799/pitch
http://127.0.0.1:8799/yaw
http://127.0.0.1:8799/throttle
```

Each draws that axis's curve, the live dot and the numbers on a transparent background. The app's **OBS** tab writes these links for you, with the look you pick (colour, line, glow, grid, dot, name, numbers, background, fade), copies them and previews them. All four are also listed at `http://127.0.0.1:8799/`.

## The profile: YouTube Vertical 1080x1920

`YouTube_Vertical_1080x1920/` is an OBS profile for streaming to YouTube on phones (the Shorts feed only takes a vertical stream).

| | |
| --- | --- |
| Canvas and output | 1080 × 1920 (9:16) |
| Frame rate | 60 fps |
| Encoder | NVENC H.264, CBR **9000 kbps**, keyframe every 2 s, preset p5, profile high, 2 B-frames, psycho-visual tuning on |
| Audio | AAC 160 kbps, 48 kHz stereo |
| Recording | the same encoder at CQP 20, hybrid MP4, into `D:\Recordings\OBS` |
| Service | YouTube – RTMPS, **stream key left empty** |

YouTube asks for a keyframe every 2 s (4 s at most) and 128 kbps or more of audio, and gives 1080p60 as 12 Mbps recommended within a 4–10 Mbps range; a 1080 × 1920 frame is the same pixel count as normal 1080p, so the same numbers apply. If the upload can't hold it, drop to 30 fps first, then to 6000 kbps, and keep the resolution.

**To install it:** copy `YouTube_Vertical_1080x1920/` into
`%APPDATA%\obs-studio\basic\profiles\`, start OBS again, and pick it under
**Profile**. Then paste your stream key into Settings → Stream.

`obs64.exe --profile "YouTube Vertical 1080x1920"` starts OBS on it - the quotes
matter, or OBS reads only the first word and keeps the profile it had.
