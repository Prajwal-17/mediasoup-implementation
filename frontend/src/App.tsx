import { useEffect } from "react";
import { io } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

const App = () => {
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
              sendTransport = device.createSendTransport(transportOptions);
              // console.log("Client: Transport created", sendTransport);

              sendTransport.on("connect", ({ dtlsParameters }, callback) => {
                socket.emit("transport-connect", { dtlsParameters }, callback);
              });

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
    </>
  );
};

export default App;
