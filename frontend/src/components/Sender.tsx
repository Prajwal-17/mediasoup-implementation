import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

const Sender = () => {
  // create a ref for the video element
  const myVidRef = useRef<HTMLVideoElement>(null);
  const receiverRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const socket = io("ws://localhost:8080");
    let device: mediasoupClient.types.Device;
    let sendTransport: mediasoupClient.types.Transport;
    // let recvTransport: mediasoupClient.types.Transport;
    // let videoConsumer: mediasoupClient.types.Consumer;

    socket.on("connect", async () => {
      console.log("Client Side Socket Connection Successfull", socket.id);

      // get router rtp capabilities from server and store it
      socket.emit(
        "getRtpCapabilites",
        async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
          device = new mediasoupClient.Device(); // create a state to hold rtpCapabilites in frontend(mediasoup specific)
          await device.load({ routerRtpCapabilities: rtpCapabilities });

          // create a send transport
          socket.emit(
            "createSendTransport",
            async (
              transportOptions: mediasoupClient.types.TransportOptions,
            ) => {
              sendTransport = device.createSendTransport({
                ...transportOptions,
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
              }); // creates a new sendtransport object containing the remote sdp

              sendTransport.on("connect", ({ dtlsParameters }, callback) => {
                socket.emit(
                  "send-transport-connect",
                  { dtlsParameters },
                  callback,
                );
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
                    ({ id }: { id: string }) => {
                      callback({ id });
                    },
                  );
                },
              );

              const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
              });

              if (myVidRef.current) {
                myVidRef.current.srcObject = stream;
              }

              const videoTrack = stream.getVideoTracks()[0];
              await sendTransport.produce({ track: videoTrack });

              console.log("Stream sent");
            },
          );

          // create a recv transport
          // socket.emit(
          //   "createRecvTransport",
          //   async (
          //     transportOptions: mediasoupClient.types.TransportOptions,
          //   ) => {
          //     recvTransport = device.createRecvTransport({
          //       ...transportOptions,
          //       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          //     });
          //     recvTransport.on("connect", ({ dtlsParameters }, callback) => {
          //       socket.emit(
          //         "recv-transport-connect",
          //         { dtlsParameters },
          //         callback,
          //       );
          //     });
          //     socket.emit(
          //       "transport-consume",
          //       { rtpCapabilities: device.rtpCapabilities },
          //       async (data: {
          //         id: string;
          //         producerId: string;
          //         kind: mediasoupClient.types.MediaKind;
          //         rtpParameters: mediasoupClient.types.RtpParameters;
          //       }) => {
          //         const consumer = await recvTransport.consume({
          //           id: data.id,
          //           producerId: data.producerId,
          //           kind: data.kind,
          //           rtpParameters: data.rtpParameters,
          //         });
          //         if (consumer.kind === "video") {
          //           videoConsumer = consumer;
          //         }
          //         socket.emit("consumer-resume", (callback: string) => {
          //           console.log(callback);
          //         });
          //
          //         const { track } = videoConsumer;
          //         if (consumer.kind === "video") {
          //           const receiverStream = new MediaStream([track]);
          //           if (receiverRef.current) {
          //             receiverRef.current.srcObject = receiverStream;
          //           }
          //         }
          //       },
          //     );
          //   },
          // );
        },
      );
    });
  }, []);
  return (
    <>
      <div>
        <video
          ref={myVidRef}
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
      <div>
        <video
          ref={receiverRef}
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
          Receiver Video
        </div>
      </div>
    </>
  );
};

export default Sender;
