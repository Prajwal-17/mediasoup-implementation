import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Receiver from "./components/Receiver";

const App = () => {
  // create a ref for the video element
  const videoRef = useRef<HTMLVideoElement>(null);

  // state to hold the media stream metadata
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const socket = io("ws://localhost:8080");
    let device: mediasoupClient.types.Device;
    let sendTransport: mediasoupClient.types.Transport;

    socket.on("connect", async () => {
      console.log("Client Side Socket Connection Successfull", socket.id);

      // get router rtp capabilities from server and store it
      socket.emit(
        "getRtpCapabilites",
        async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
          device = new mediasoupClient.Device(); // create a state to hold rtpCapabilites in frontend(mediasoup specific)
          await device.load({ routerRtpCapabilities: rtpCapabilities });

          // create a send/recv transport
          socket.emit(
            "createSendTransport",
            async (
              transportOptions: mediasoupClient.types.TransportOptions
            ) => {
              // console.log("server transport data", transportOptions);
              sendTransport = device.createSendTransport(transportOptions); // creates a new sendtransport object containing the remote sdp
              // console.log("Client: Transport created", sendTransport);

              sendTransport.on("connect", ({ dtlsParameters }, callback) => {
                // console.log("here in transport connect");
                socket.emit("transport-connect", { dtlsParameters }, callback);
              });

              // setup a listner on produce event, fires when sendTransport.produce() is called locally
              // kind : "audio" | "video"
              // rtpParameters : encoding/decoding params of the media
              sendTransport.on(
                "produce",
                ({ kind, rtpParameters }, callback) => {
                  socket.emit(
                    "transport-produce",
                    { kind, rtpParameters },
                    ({ id }: any) => {
                      callback({ id });
                    }
                  );
                }
              );

              const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
              });

              setStream(stream);

              if (videoRef.current) {
                videoRef.current.srcObject = stream;
              }

              const videoTrack = stream.getVideoTracks()[0];
              await sendTransport.produce({ track: videoTrack });

              console.log("Stream sent");
            }
          );
        }
      );
    });
  }, []);

  return (
    <>
      <div className="bg-red-500">Video Conferencing App</div>
      <BrowserRouter>
        <Routes>
          <Route path="/receiver" element={<Receiver />} />
        </Routes>
      </BrowserRouter>
      <div>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "300px",
            margin: "5px",
            height: "auto",
            transform: "scaleX(-1)", // Mirror effect
            display: "block",
          }}
        />
        <div className="bg-black text-white px-2 py-3  inline-block rounded-lg m-4">
          My Video
        </div>
      </div>
    </>
  );
};

export default App;
