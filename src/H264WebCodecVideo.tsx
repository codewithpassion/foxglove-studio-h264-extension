import { Box } from "@mui/material";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import Worker from "./workers/Render.worker.ts";
import { InitRenderEvent, RenderEvent, WorkerEvent } from "./workers/RenderEvents";

export type H264WebCodecVideoProps = {
  frameData: Uint8Array | undefined;
  renderDone: (() => void) | undefined;
};

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
      worker.postMessage(new RenderEvent(frameData.buffer), [frameData.buffer]);
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
