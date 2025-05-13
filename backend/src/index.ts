import express, { Request, Response } from "express"
import * as mediasoup from "mediasoup"
import { Router } from "mediasoup/node/lib/RouterTypes";

const app = express();

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ msg: "Request arrived" })
})

app.listen(3000, () => {
  console.log("Listening on port 3000")
})

// array of codec capabalities
const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1
    },
    rtcpFeedback: [
      { type: "nack" },
      { type: "nack", parameter: "pli" },
      { type: "ccm", parameter: "fir" },
      { type: "goog-remb" }
    ]
  },
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
    parameters: {
      useinbandfec: 1,
      usedtx: 1
    },
    rtcpFeedback: []
  }
];

async function main() {
  try {
    // const mediasoupWorkers = [] //for multiple workers

    const worker = await mediasoup.createWorker({
      logLevel: "none",
      logTags: [],
      rtcMinPort: 10000, // rtcMinPort & rtcMaxPort represents the range of UDP and TCP ports used for webRTC
      rtcMaxPort: 59999
    })

    // worker.on('died', () => {
    //   console.error('mediasoup Worker died (it will be automatically reaped)');
    //   // Handle worker death, e.g., create a new worker or exit the application
    // });

    // mediasoupWorkers.push(worker)
    // console.log(worker.pid);


    const router = await worker.createRouter({ mediaCodecs });
    // console.log("router", router)
    // console.log('Mediasoup Router created:', router.id);


    console.log("worker", worker)
  } catch (error) {
    console.log(error)
  }
}

main()