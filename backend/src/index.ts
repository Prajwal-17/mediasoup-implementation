import express, { Request, Response } from "express"
import * as mediasoup from "mediasoup"
import { startSocketServer } from "./socket";
import dotenv from "dotenv"

const app = express();
dotenv.config()

process.env.DEBUG = "mediasoup:*"

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

type MediasoupStateType = {
  worker: mediasoup.types.Worker | null,
  router: mediasoup.types.Router | null,
  transports: Map<string, mediasoup.types.WebRtcTransport>,
  producers: Map<string, mediasoup.types.Producer>,
  consumers: Map<string, mediasoup.types.Consumer>
}

export const mediasoupState: MediasoupStateType = {
  worker: null,
  router: null,
  transports: new Map(),
  producers: new Map(),
  consumers: new Map()
}

async function main() {
  try {
    // const mediasoupWorkers = [] //for multiple workers

    const worker = await mediasoup.createWorker({
      logLevel: "warn",
      logTags: ["ice", "dtls", "rtp", "rtcp", "srtp", "bwe", "score"],
      rtcMinPort: 10000, // rtcMinPort & rtcMaxPort represents the range of UDP and TCP ports used for webRTC
      rtcMaxPort: 59999
    })

    const router = await worker.createRouter({ mediaCodecs });

    mediasoupState.worker = worker
    mediasoupState.router = router

  } catch (error) {
    console.log(error)
  }
}

main()
startSocketServer()