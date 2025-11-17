## TeraSpot Fog Node

This edge component publishes parking occupancy readings to AWS IoT Core. It now
emits **per-space state change events** so the cloud backend receives only the
updates it needs. Configure the publisher with:

- `AWS_IOT_ENDPOINT`, `AWS_IOT_CERT_PATH`, `AWS_IOT_THING_NAME`
- `AWS_IOT_FACILITY_ID` and `AWS_IOT_ZONE_ID` (used to derive the topic
  `teraspot/{facility}/{zone}/{thing}/status`, unless `AWS_IOT_TOPIC` is set)

At runtime it can operate in two modes:

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
