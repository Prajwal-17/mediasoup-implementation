import * as mediasoupClient from "mediasoup-client";
import { useEffect } from "react";
import io from "socket.io-client";

const Receiver = () => {
  useEffect(() => {
    const socket = io("ws://localhost:8080");

    let device: mediasoupClient.types.Device;
    let recvTransport: mediasoupClient.types.Transport;
    let videoConsumer: mediasoupClient.types.Consumer;

    socket.on("connection", () => {
      console.log("Client Socket Connection Successfull ");

      socket.emit(
        "getRtpCapabilities",
        async (rtpCapabilites: mediasoupClient.types.RtpCapabilities) => {
          device = new mediasoupClient.Device();
          await device.load({ routerRtpCapabilities: rtpCapabilites });

          socket.emit(
            "createRecvTransport",
            async (
              transportOptions: mediasoupClient.types.TransportOptions
            ) => {
              recvTransport = device.createRecvTransport(transportOptions);

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
                  videoConsumer = await recvTransport.consume({
                    id: data.id,
                    producerId: data.producerId,
                    kind: data.kind,
                    rtpParameters: data.rtpParameters,
                  });

                  //resume consumer
                  socket.emit("consumer")
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
    </>
  );
};

export default Receiver;
