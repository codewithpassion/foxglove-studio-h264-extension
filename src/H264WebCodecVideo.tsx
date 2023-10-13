import { Box } from "@mui/material";
import { Buffer } from "buffer";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import Worker from "./workers/Render.worker";
import { InitRenderEvent, RenderEvent, WorkerEvent } from "./workers/RenderEvents";

export type H264WebCodecVideoProps = {
  frameData: Uint8Array | undefined;
  renderDone: (() => void) | undefined;
};

function copyArray(src: ArrayBufferLike) {
  const dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
}

const H264WebCodecVideo: React.FC<H264WebCodecVideoProps> = ({ frameData, renderDone }) => {
  const renderDoneRef = useRef(renderDone);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);

  const onWorkerMessage = useCallback(({ data: event }: globalThis.MessageEvent<WorkerEvent>) => {
    if (event.type === "renderDone") {
      renderDoneRef.current?.();
    } else if (event.type === "status") {
      // We could display the fps?
    }
  }, []);

  // Create webworker and subscribe to 'message' event.
  const worker = useMemo(() => {
    if (canvasElement) {
      const result = new Worker();
      result.addEventListener("message", onWorkerMessage);

      const canvas = canvasElement;
      const offscreenCanvas: OffscreenCanvas = canvas.transferControlToOffscreen();
      result.postMessage(new InitRenderEvent(offscreenCanvas), [offscreenCanvas]);
      return result;
    }
    return undefined;
  }, [onWorkerMessage, canvasElement]);

  useLayoutEffect(() => {
    if (canvasRef.current) {
      setCanvasElement(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    if (worker && frameData) {
      // we need to copy the data buffer as it will be transfered to the background worker.
      // Otherwise we risk exceptions in other parts of studio.
      const buffer = copyArray(Buffer.from(frameData));
      worker.postMessage(new RenderEvent(buffer), [buffer]);
    }
  }, [frameData, worker]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <canvas style={{ width: "100%", height: "auto" }} ref={canvasRef}></canvas>
    </Box>
  );
};

export default H264WebCodecVideo;
