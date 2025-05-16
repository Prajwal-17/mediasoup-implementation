import * as mediasoupClient from "mediasoup-client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const Receiver = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const socket = io("ws://localhost:8080");

    let device: mediasoupClient.types.Device;
    let recvTransport: mediasoupClient.types.Transport;
    let videoConsumer: mediasoupClient.types.Consumer;

    socket.on("connect", async () => {
      console.log("Client Socket Connection Successfull Receiver Page");

      socket.emit(
        "getRtpCapabilites",
        async (rtpCapabilites: mediasoupClient.types.RtpCapabilities) => {
          // console.log("rtpcapabilites", rtpCapabilites);
          device = new mediasoupClient.Device();
          await device.load({ routerRtpCapabilities: rtpCapabilites });

          socket.emit(
            "createRecvTransport",
            async (
              transportOptions: mediasoupClient.types.TransportOptions
            ) => {
              console.log("transport options", transportOptions);
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
                  console.log("client consume transport started ");
                  const consumer = await recvTransport.consume({
                    id: data.id,
                    producerId: data.producerId,
                    kind: data.kind,
                    rtpParameters: data.rtpParameters,
                  });

                  if (consumer.kind === "video") {
                    videoConsumer = consumer;
                  }

                  //resume consumer
                  socket.emit("consumer-resume", (callback: any) => {
                    console.log(callback);
                  });

                  const { track } = consumer;
                  console.log("track", track);
                  if (consumer.kind === "video" && videoRef.current) {
                    const stream = new MediaStream([track]);
                    setStream(stream);
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                  }
                }
              );
            }
          );
        }
      );
    });
  }, []);

  return (
    <>
      <div className="">Receiver Component</div>
      <div>
        <video
          ref={videoRef}
          autoPlay
          muted
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
      </div>
    </>
  );
};

export default Receiver;
