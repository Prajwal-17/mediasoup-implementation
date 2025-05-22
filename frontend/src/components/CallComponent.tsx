import { useEffect, useRef } from "react";
import * as mediasoupClient from "mediasoup-client";
import { io } from "socket.io-client";

const CallComponent = () => {
  // create a ref for the video element
  const myVidRef = useRef<HTMLVideoElement>(null);
  const receiverRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const socket = io("ws://localhost:8080");
    let device: mediasoupClient.types.Device;
    let sendTransport: mediasoupClient.types.Transport;
    let recvTransport: mediasoupClient.types.Transport;

    socket.on("connect", async () => {
      socket.on("error", (err) => {
        console.log("socket error", err);
      });
      console.log("Client Side Socket Connection Successfull", socket.id);

      // get router rtp capabilities from server and store it
      socket.emit(
        "getRtpCapabilites",
        async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
          // console.log("rtpcap", rtpCapabilities);
          device = new mediasoupClient.Device(); // create a state to hold rtpCapabilites in frontend(mediasoup specific)
          await device.load({ routerRtpCapabilities: rtpCapabilities });

          // create a send transport
          socket.emit(
            "createSendTransport",
            async (
              transportOptions: mediasoupClient.types.TransportOptions, // sending a callback function
            ) => {
              sendTransport = device.createSendTransport({
                ...transportOptions,
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
              }); // creates a new sendtransport object containing the remote sdp

              // pass dtls to make a handshake with server
              sendTransport.on("connect", ({ dtlsParameters }, callback) => {
                console.log("dtlsprams", dtlsParameters);
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
                async ({ kind, rtpParameters }, callback) => {
                  try {
                    console.log("sendTransport.on");

                    // Emit the event and wait for the server response
                    socket.emit(
                      "transport-produce",
                      { kind, rtpParameters },
                      ({ id }: any) => {
                        console.log("Producer ID received from server:", id);

                        callback({ id });
                      },
                    );
                  } catch (error) {
                    console.error("Error in produce event:", error);
                  }
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
              await sendTransport.produce({ track: videoTrack }); // trigger a producer to send stream

              console.log("Stream sent");
            },
          );

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
                socket.emit(
                  "recv-transport-connect",
                  { dtlsParameters },
                  callback,
                );
              });
            },
          );

          // — inside your useEffect, after creating recvTransport —
          socket.on(
            "new-producer",
            async ({
              producerId,
              producerSocketId,
            }: {
              producerId: string;
              producerSocketId: string;
            }) => {
              console.log("new-producer", producerId, "from", producerSocketId);

              // 1️⃣ ignore your own broadcast
              if (producerSocketId === socket.id) return;

              // 2️⃣ request to consume that peer’s producer
              socket.emit(
                "transport-consume",
                {
                  producerId,
                  rtpCapabilities: device.rtpCapabilities,
                },
                async (data: {
                  id: string;
                  producerId: string;
                  kind: mediasoupClient.types.MediaKind;
                  rtpParameters: mediasoupClient.types.RtpParameters;
                  error?: string;
                }) => {
                  if (data.error) {
                    console.error("Cannot consume:", data.error);
                    return;
                  }

                  try {
                    console.log("before consumer", recvTransport);
                    const consumer = await recvTransport.consume({
                      id: data.id,
                      producerId: data.producerId,
                      kind: data.kind,
                      rtpParameters: data.rtpParameters,
                    });

                    console.log("consumer created", consumer);

                    socket.emit("consume-resume", (callback: string) => {
                      console.log("server response:", callback);
                    });

                    if (consumer.kind === "video" && receiverRef.current) {
                      const stream = new MediaStream([consumer.track]);
                      receiverRef.current.srcObject = stream;
                    }
                    await consumer.resume();

                    console.log(
                      "Receiving media stream from peer:",
                      data.producerId,
                    );
                  } catch (err) {
                    console.error("error in transport-consume callback:", err);
                  }
                },
              );
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

export default CallComponent;
