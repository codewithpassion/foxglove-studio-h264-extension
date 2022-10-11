# H264 render extension - based on custom-image-extension

*Important* this does not work with the standard Foxglove studio. 
The desktop app does not  have a Content Security Policy for `media-src`. 
Therefore, the video won't render. 

To fix this, you will need to change `foxglove/studio/desktop/index.ts`.
Add ```"media-src": "'self' data: https: package: http: blob:",``` to the ```const contentSecurityPolicy```
on line 248. See https://github.com/foxglove/studio/blob/main/desktop/main/index.ts#L248 

