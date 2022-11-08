import { Box } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

import useCanvasSize, { Size } from "./hooks/useCanvasSize";
import Worker from "./workers/Render.worker?raw";
import { InitRenderEvent, RenderEvent, WorkerEvent } from "./workers/RenderEvents";

export type H264WebCodecVideoProps = {
  frameData: Uint8Array | undefined;
  renderDone: (() => void) | undefined;
  canvasUpdated?: (size: Size) => void;
};

function copyArray(src: ArrayBufferLike) {
  const dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
}

const H264WebCodecVideo: React.FC<H264WebCodecVideoProps> = ({
  frameData,
  renderDone,
  canvasUpdated,
}) => {
  const initialRenderDone = useRef(false);
  const renderDoneRef = useRef<() => void>();
  // const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasRefSetter, canvasPosition, canvasElement] = useCanvasSize<HTMLCanvasElement>();

  useEffect(() => {
    renderDoneRef.current = renderDone;
  }, [renderDone]);

  useEffect(() => {
    if (canvasPosition) {
      canvasUpdated?.(canvasPosition);
    }
  }, [canvasPosition, canvasUpdated]);

  const onWorkerMessage = useCallback(
    ({ data: event }: globalThis.MessageEvent<WorkerEvent>) => {
      if (event.type === "renderDone") {
        renderDoneRef.current?.();

        if (!initialRenderDone.current) {
          const rec = canvasElement?.getBoundingClientRect();
          if (rec) {
            canvasUpdated?.(rec);
          }
        }
      } else if (event.type === "status") {
        // We could display the fps?
      }
    },
    [canvasElement, canvasUpdated],
  );

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

  // useLayoutEffect(() => {
  //   if (canvasElement) {
  //     canvasUpdated?.(getOffset(canvasElement));
  //   }
  // }, [canvasElement, canvasUpdated]);

  useEffect(() => {
    if (worker && frameData) {
      // we need to copy the data buffer as it will be transfered to the background worker.
      // Otherwise we risk exceptions in other parts of studio.
      const buffer = copyArray(frameData.buffer);
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
      <canvas style={{ width: "100%", height: "auto" }} ref={canvasRefSetter}></canvas>
    </Box>
  );
};

export default H264WebCodecVideo;
