import { Box } from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { Remuxer } from "./lib/remuxer";

export type H264VideoProps = { frameData: Uint8Array | undefined };

async function getSourceBuffer(mediaSource: MediaSource, codec: string): Promise<SourceBuffer> {
  /**
   * Before we can actually add the video, we need to:
   *  - Create a SourceBuffer, attached to the MediaSource object
   *  - Wait for the SourceBuffer to "open"
   */
  /** @type {SourceBuffer} */
  return await new Promise((resolve, reject) => {
    const initSourceBuffer = () => {
      try {
        const sourceBuffer = mediaSource.addSourceBuffer(`video/mp4; codecs="${codec}"`);

        ["abort", "error", "update", "updateend", "updatestart"].forEach((ev) => {
          sourceBuffer.addEventListener(ev, () => {
            console.log(`XX: SourceBuffer ${ev}`);
          });
        });

        sourceBuffer.addEventListener("error", (ev) => {
          console.error(`XX: SourceBuffer error: `, ev);
        });

        resolve(sourceBuffer);
      } catch (e) {
        reject(e);
      }
    };
    if (mediaSource.readyState === "open") {
      initSourceBuffer();
    } else {
      mediaSource.addEventListener("sourceopen", initSourceBuffer);
    }
  });
}

const H264Video: React.FC<H264VideoProps> = ({ frameData }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  //   const { mediaSource, sourceBuffer } = useMemo(async () => {
  const mediaSource = useMemo(() => new MediaSource(), []);
  const [sourceBuffer, setSourceBuffer] = useState<SourceBuffer | undefined>(undefined);
  const [codec, setCodec] = useState<string | undefined>(undefined);

  const remuxer = useMemo(() => {
    const newRemuxer = new Remuxer();
    newRemuxer.onReady = (_codec) => setCodec(_codec);
    return newRemuxer;
  }, []);

  useEffect(() => {
    if (sourceBuffer && remuxer != undefined) {
      remuxer.setSourceBuffer(sourceBuffer);
    }
  }, [remuxer, sourceBuffer]);

  useEffect(() => {
    if (frameData) {
      remuxer.feed(frameData);
    }
  }, [frameData, remuxer]);

  useEffect(() => {
    if (videoRef.current && mediaSource != undefined) {
      videoRef.current.src = URL.createObjectURL(mediaSource);
      videoRef.current.play().catch((err) => console.error(err));
    }
  }, [mediaSource]);

  useEffect(() => {
    if (mediaSource != undefined && codec) {
      void getSourceBuffer(mediaSource, codec).then((buffer) => setSourceBuffer(buffer));
    }
  }, [codec, mediaSource]);

  // log
  // useEffect(() => {
  //   ["onsourceclose", "onsourceended", "onsourceopen"].forEach((ev) =>
  //     mediaSource.addEventListener(ev, () => console.log(`XX: MediaSource event: ${ev}`)),
  //   );
  // }, [mediaSource]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
      }}
    >
      <video
        style={{ width: "100%", height: "auto" }}
        controls={false}
        ref={videoRef}
        src=""
        muted
        preload="metadata"
      ></video>
    </Box>
  );
};

export default H264Video;
