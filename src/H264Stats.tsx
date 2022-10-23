import { Box } from "@mui/material";
import React from "react";

export type H264StatsProps = {
  fps: number;
  bps: string;
  currentTime: string;
  bufferTime: number;
  bufferTimeStart: number;
  bufferTimeEnd: number;
  gaptime: number;
  queueSize: number;
  error: boolean;
  paused: boolean;
  videoState: string;
  droppedFrames: number;
  decodedFrames: number;
};

const H264Stats: React.FC<H264StatsProps> = ({
  fps,
  bps,
  currentTime,
  bufferTime,
  bufferTimeEnd,
  bufferTimeStart,
  gaptime,
  queueSize,
  error,
  paused,
  videoState,
  droppedFrames,
  decodedFrames,
}) => {
  const formatSeconds = (seconds: number) => {
    return Number(seconds).toFixed(2) + " seconds";
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        top: 0,
        left: 0,
        position: "absolute",
        margin: 10,
        color: "orange",
        fontSize: "2vw",
      }}
    >
      <div>
        FPS: <span>{fps}</span>
      </div>
      <div>
        BPS: <span>{bps}</span>
      </div>
      <div>
        current time: <span>{currentTime}</span>
      </div>
      <div>
        buffer time: <span>{formatSeconds(bufferTime)}</span>
      </div>
      <div>
        buffertime start: <span>{formatSeconds(bufferTimeStart)}</span>
      </div>
      <div>
        buffertime end: <span>{formatSeconds(bufferTimeEnd)}</span>
      </div>
      <div>
        gap time: <span>{formatSeconds(gaptime)}</span>
      </div>
      <div>
        Video error?: <span>{error}</span>
      </div>
      <div>
        queue size: <span>{queueSize}</span>
      </div>
      <div>
        paused: <span>{paused ? "true" : "false"}</span>
      </div>
      <div>
        video state: <span>{videoState}</span>
      </div>
      <div>
        dropped frames: <span>{droppedFrames}</span>
      </div>
      <div>
        decoded frames: <span>{decodedFrames}</span>
      </div>
    </Box>
  );
};

export default H264Stats;
