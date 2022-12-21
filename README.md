# H264 render extension - based on custom-image-extension

This extension is based on [WebCodecs](https://w3c.github.io/webcodecs/) and a WebGL renderer.
It accepts H264 NALUs - noteably IDR frames, SPS, PPS, and NDR frames - and pushes them through WebCodecs to get images.
The images are then rendered on a canvas as fast as they are produced from the _WebCodec_.

The decoding is done in a _WebWorker_ for better UI performance.

_**NOTE: WebCodecs are currently in development and not all browsers support them!**_

## Expected data

Currently, the extension expects the image data to be in a message of type _sensor_msgs/CompressedImage_.
A message can contain one or multiple frames. See below for more info on frame types.

### IDR/Keyframes (and SPS, PPS)

It's expected that that SPS, PPS and IDR frames are sent in one message.
Upon receipt of a SPS/PPS combo, we can start configuring the codec. And the IDR (keyframe) then is sent to the codec and we can get the first frame.

### NDR (P-Frames)

NDR frames are sent to the decoder once the first SPS/PPS/IDR frame combo has been received.

### B-Frames

Not currently supported.

## Known issues

### Seeking

Currently, seeking is not specifically supported.
If you happen to _seek_ to a keyframe, everything will be fine.
But if you end up on a P-frame, theere will be artifacts until the next IDR frame is received and the iamage is redrawn.

This should be solvable by subscribing to `allFrames` and going back in time from the seek position to find the last IDR frame and run the video frames up to the seek position.

### Error handling

Errors arrent currently handled nicely. If there was a decoder error, it is printed out on the developer console as an error but not yet brought to the UI.

# Thanks

This extension was supported by MissionRobotics (http://missionrobotics.us)
