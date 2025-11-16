## TeraSpot Fog Node

This edge component publishes parking occupancy readings to AWS IoT Core. It can
run in two modes:

- **Mocked data** using synthetic parking slots (default).
- **YOLO-based inference** using either a still image or a looping video.

### Running YOLO inference with a video

1. Place the video file under `fog/assets/` (example: `assets/parking_lot.mp4`).
2. Provide the video path when launching the publisher:

```bash
cd fog
python src/edge_publisher.py \
  --use-yolo \
  --video assets/parking_lot.mp4 \
  --frame-skip 5 \
  --iterations -1 \
  --interval 5
```

The `--frame-skip` flag controls how many frames to skip between inferences to
balance accuracy and CPU usage (0 = process every frame). When the video reaches
the end it is rewound automatically so the feed loops continuously.

If `--video` is omitted, the publisher falls back to the static image set via
`--image`.
