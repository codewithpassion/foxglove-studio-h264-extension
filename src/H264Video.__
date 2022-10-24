import { Box } from "@mui/material";
import React, { useCallback, useEffect, useRef, useState } from "react";

import H264Stats from "./H264Stats";

export type H264VideoProps = {
  frameData: Uint8Array;
};

const mediaSourceEvents = [
  "sourceopen",
  "sourceended",
  "sourceclose",
  "loadedmetadata",
  "loadeddata",
  "canplay",
  "canplaythrough",
  "seeking",
  "ended",
  "loadstart",
  "playing",
  "waiting",
  "progress",
  "suspend",
  "stalled",
];

const videoEvents = [
  "loadstart",
  "emptied",
  "canplaythrough",
  "ended",
  "ratechange",
  "progress",
  "stalled",
  "playing",
  "durationchange",
  "resize",
  "suspend",
  "loadedmetadata",
  "waiting",
  "timeupdate",
  "volumechange",
  "abort",
  "loadeddata",
  "seeking",
  "play",
  "error",
  "canplay",
  "seeked",
  "pause",
];

const H264Video: React.FC<H264VideoProps> = ({ frameData }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [fpsCount, setFpsCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [datapacketsCounts, setDatapacketsCounts] = useState(0);
  const [bpsCount, setBpsCount] = useState(0);
  const [bps, setBps] = useState("");
  const [curretTime, setCurretTime] = useState("");
  const [buffertime, setBuffertime] = useState(0);
  const [buffertimeStart, setBuffertimeStart] = useState(0);
  const [buffertimeEnd, setBuffertimeEnd] = useState(0);
  const [gaptime, setGaptime] = useState(0);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [decodedFrames, setDecodedFrames] = useState(0);
  const [paused, setPaused] = useState(true);
  const [error, setError] = useState(false);
  const [queue, setQueue] = useState<BufferSource[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [mediasource, setMediasource] = useState<MediaSource | undefined>(undefined);
  const [videoState, setVideoState] = useState("");

  const sourceBufferRef = useRef<SourceBuffer | null>(null);

  const updateStats = useRef(
    useCallback(() => {
      if (videoRef.current) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const xDroppedFrames = videoRef.current.webkitDroppedFrameCount as number;
        setDroppedFrames(xDroppedFrames);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const xDecodedFrames = videoRef.current.webkitDecodedFrameCount as number;
        setDecodedFrames(xDecodedFrames);

        setFps(droppedFrames + decodedFrames - fpsCount);
        setBps((bpsCount * 8).toLocaleString());
        setFpsCount(xDroppedFrames + xDecodedFrames);
        setBpsCount(0);

        if ((sourceBufferRef.current?.buffered?.length ?? 0) <= 0) {
          return;
        }

        if (
          sourceBufferRef.current?.updating === false &&
          (videoRef.current?.buffered?.length ?? 0) > 0
        ) {
          if (videoRef.current != undefined && sourceBufferRef.current != undefined) {
            if (videoRef.current.currentTime - 90 > videoRef.current.buffered.start(0)) {
              sourceBufferRef.current.remove(
                videoRef.current.buffered.start(0),
                videoRef.current.currentTime - 90,
              );
            }
          }
        }

        // if (!self.latencyReducer) return;
        // //video.currentTime = self.sourceBuffer.buffered.end(0);

        // if( (video.buffered.length > 0) && (video.seekable.end(0)-video.currentTime) > .20){
        //     video.currentTime=video.seekable.end(0)-.001;
        // }
      }
    }, [bpsCount, decodedFrames, droppedFrames, fpsCount]),
  );

  const updateVideoState = useRef(
    useCallback(() => {
      setPaused(videoRef.current?.paused === true);
      setQueueSize(queue.length);
      setError(videoRef.current?.error != null);
      setCurretTime(videoRef.current?.currentTime?.toLocaleString() ?? "");
      if (mediasource?.readyState !== "open") {
        return;
      }
      if (sourceBufferRef.current == null) {
        return;
      }
      if (sourceBufferRef.current.buffered.length > 0) {
        setBuffertime(
          sourceBufferRef.current.buffered.end(0) - sourceBufferRef.current.buffered.start(0),
        );
        if (videoRef.current) {
          setGaptime(videoRef.current.buffered.end(0) - videoRef.current.currentTime);
          setBuffertimeStart(videoRef.current.buffered.start(0));
          setBuffertimeEnd(videoRef.current.seekable.end(0));
        }
      }

      if (videoState === "stalled" && sourceBufferRef.current.buffered.length > 0) {
        if (videoRef.current) {
          //Assume we are stuck.. again
          videoRef.current.currentTime = videoRef.current.seekable.end(0);
          console.log("bumbing...");
        }
      }
    }, [mediasource?.readyState, queue.length, videoState]),
  );

  const play = useCallback(() => {
    console.log("H264Video: Play");

    setQueue([]);
    let initQueued = false;
    let waitingForDecoderReset = 0;

    if (mediasource?.readyState !== "open") {
      setTimeout(play.bind(this, 500));
      console.log("retrying source open");
      return;
    }

    // eslint-disable-next-line no-warning-comments
    // TODO get from video
    const sourceBuffer = mediasource.addSourceBuffer('video/mp4; codecs="avc1.4d401e"');
    sourceBufferRef.current = sourceBuffer;

    ["error", "abort"].forEach((ev) => {
      sourceBufferRef.current?.addEventListener(ev, () => {
        console.log(`source buffer event ${ev}`);
      });
    });

    let lastBuffer = 0;
    let lastDecoded = 0;

    sourceBuffer.addEventListener("updateend", () => {
      if (mediasource.readyState !== "open") {
        console.log(`Media not open - in state ${mediasource.readyState}`);
        return;
      }

      if (videoRef.current?.error != null) {
        console.error(`HTML Video element in error state ${videoRef.current.error.message}`);
        return;
      }

      if (queue.length > 0 && !sourceBuffer.updating) {
        console.error("Frame rejected");
        if (videoRef.current) {
          videoRef.current.currentTime += 0.001;
        }
        if (sourceBuffer.buffered.length > 0) {
          lastBuffer = sourceBuffer.buffered.end(0);
        }
        const lastFrame = queue.shift();
        if (lastFrame) {
          sourceBuffer.appendBuffer(lastFrame);
        }
      }

      if (
        lastDecoded > 0 &&
        Date.now() > waitingForDecoderReset &&
        videoState !== "stalled" &&
        videoRef.current != null &&
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        lastDecoded === (videoRef.current.webkitDecodedFrameCount as number)
      ) {
        console.log("Decoder stall detected");
        if (!sourceBuffer.updating) {
          sourceBuffer.abort();
          videoRef.current.currentTime = videoRef.current.seekable.end(0);
          console.log("Aborting buffer");
          waitingForDecoderReset = Date.now() + 1000;
        }
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      lastDecoded = videoRef.current.webkitDecodedFrameCount as number;
    });
  }, [mediasource, queue, videoState]);

  const createMediaSource = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (!window.MediaSource) {
      throw Error("Oops! Browser does not support media source extension.");
    }

    const mediaSource = new MediaSource();
    mediaSourceEvents.forEach((ev) => {
      mediaSource.addEventListener(ev, () => {
        console.log(`Mediasource event: ${ev}`);
      });
    });

    mediaSource.addEventListener("sourceopen", () => {
      play();
    });

    ["addsourcebuffer", "removesourcebuffer"].forEach((ev) => {
      mediaSource.sourceBuffers.addEventListener(ev, () => {
        console.log(`sourceBuffer event: ${ev}`);
      });
    });
    return mediaSource;
  }, [play]);

  useEffect(() => {
    const mediaSource = createMediaSource();

    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSource);
    }

    videoEvents.forEach((ve) => {
      videoRef.current?.addEventListener(ve, () => {
        console.log(`VideElement event: ${ve}`);
        if (ve === "seeking" && videoRef.current) {
          if (videoRef.current?.currentTime > videoRef.current.buffered.end(0)) {
            console.error("SHOULD NOT BE POSSIBLE");
          }
        }

        if (ve === "error") {
          console.log(`Video error: ${videoRef.current?.error?.code ?? "???"}`);

          if (videoRef.current) {
            videoRef.current.src = "";
            videoRef.current.load();

            const newMediaSource = createMediaSource();
            setMediasource(newMediaSource);

            videoRef.current.src = URL.createObjectURL(newMediaSource);
          }
        }
        if (ve === "ended" || ve === "stalled" || ve === "progress") {
          setVideoState(ve);
        }
      });
    });

    setMediasource(mediaSource);

    const statsUpdateInterval = setInterval(updateStats.current, 1000);
    const videoStateInterval = setInterval(updateVideoState.current, 500);

    return () => {
      clearInterval(statsUpdateInterval);
      clearInterval(videoStateInterval);
    };
  }, [createMediaSource]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
      }}
    >
      <video controls ref={videoRef} src="" preload="metadata"></video>
      <H264Stats
        bps={bps}
        bufferTime={buffertime}
        bufferTimeEnd={buffertimeEnd}
        bufferTimeStart={buffertimeStart}
        currentTime={curretTime}
        decodedFrames={decodedFrames}
        droppedFrames={droppedFrames}
        error={error}
        fps={fps}
        gaptime={gaptime}
        paused={paused}
        queueSize={queueSize}
        videoState={videoState}
      />
    </Box>
  );
};

export default H264Video;
