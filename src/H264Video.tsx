import { Box } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Remuxer } from "./lib/remuxer";

export type H264VideoProps = {
  frameData: Uint8Array | undefined;
  renderDone: (() => void) | undefined;
};

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
        sourceBuffer.mode = "segments";

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

const H264Video: React.FC<H264VideoProps> = ({ frameData, renderDone }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaSource = useMemo(() => new MediaSource(), []);
  const [sourceBuffer, setSourceBuffer] = useState<SourceBuffer | undefined>(undefined);
  const [codec, setCodec] = useState<string | undefined>(undefined);

  const remuxer = useMemo(() => {
    const newRemuxer = new Remuxer();
    newRemuxer.onReady = (_codec) => setCodec(_codec);
    return newRemuxer;
  }, []);

  const onRenderDoneRef = useRef(
    useCallback(() => {
      renderDone?.();
    }, [renderDone]),
  );

  useEffect(() => {
    console.log("XX: Setting up videoFrameCallback");

    const callback: (now: number, meta: VideoFrameMetadata) => void = (
      now: number,
      meta: VideoFrameMetadata,
    ) => {
      console.log(`videoFrameCallback: now: ${now} - `, meta);
      onRenderDoneRef.current?.();
      // set the callback again as this only is called once otherwise.
      videoRef.current?.requestVideoFrameCallback(callback);
    };

    videoRef.current?.requestVideoFrameCallback(callback);
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

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
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
      <div>AAA - {videoRef.current?.currentTime}</div>
    </Box>
  );
};

export default H264Video;
