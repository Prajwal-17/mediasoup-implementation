import * as mediasoupClient from "mediasoup-client";
import { useEffect, useRef } from "react";
import io from "socket.io-client";

const Receiver = () => {
  const receiverRef = useRef<HTMLVideoElement>(null);
  const myVidRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const socket = io("ws://localhost:8080");

    let device: mediasoupClient.types.Device;
    let recvTransport: mediasoupClient.types.Transport;
    let sendTransport: mediasoupClient.types.Transport;
    let videoConsumer: mediasoupClient.types.Consumer;

    socket.on("connect", async () => {
      console.log("Client Socket Connection Successfull Receiver Page");

      socket.emit(
        "getRtpCapabilites",
        async (rtpCapabilites: mediasoupClient.types.RtpCapabilities) => {
          device = new mediasoupClient.Device();
          await device.load({ routerRtpCapabilities: rtpCapabilites });

          // create receive transport
          socket.emit(
            "createRecvTransport",
            async (
              transportOptions: mediasoupClient.types.TransportOptions,
            ) => {
              recvTransport = device.createRecvTransport({
                ...transportOptions,
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
              });

              recvTransport.on("connect", ({ dtlsParameters }, callback) => {
                socket.emit("transport-connect", { dtlsParameters }, callback);
              });

              socket.emit(
                "consume",
                { rtpCapabilites: device.rtpCapabilities },
                async (data: {
                  id: string;
                  producerId: string;
                  kind: mediasoupClient.types.MediaKind;
                  rtpParameters: mediasoupClient.types.RtpParameters;
                }) => {
                  const consumer = await recvTransport.consume({
                    id: data.id,
                    producerId: data.producerId,
                    kind: data.kind,
                    rtpParameters: data.rtpParameters,
                  });

                  if (consumer.kind === "video") {
                    console.log("here in consumer");
                    videoConsumer = consumer;
                  }

                  socket.emit("consumer-resume", (callback: string) => {
                    console.log(callback);
                  });

                  const { track } = videoConsumer;
                  if (consumer.kind === "video" && receiverRef.current) {
                    const stream = new MediaStream([track]);
                    receiverRef.current.srcObject = stream;
                  }
                },
              );
            },
          );

          // create send transport
          socket.emit(
            "createSendTransport",
            async (
              transportOptions: mediasoupClient.types.TransportOptions,
            ) => {
              sendTransport = device.createSendTransport({
                ...transportOptions,
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
              });

              sendTransport.on("connect", ({ dtlsParameters }, callback) => {
                socket.emit("transport-connect", { dtlsParameters }, callback);
              });

              sendTransport.on(
                "produce",
                async ({ kind, rtpParameters }, callback) => {
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
            },
          );
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
          playsInline
          controls
          style={{
            width: "300px",
            margin: "5px",
            height: "auto",
            // transform: "scaleX(-1)", // Mirror effect
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

export default Receiver;
