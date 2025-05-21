import { Server } from "socket.io";
import { createServer } from "node:http";
import { mediasoupState } from ".";
import * as mediasoup from "mediasoup";

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// setInterval(() => {
//   console.log("producers", mediasoupState.producers);
// }, 3000);

io.on("connection", (socket) => {
  console.log("User connected to socket server");

  // send router rtpCapabilites to client for further negotiation
  // RTP capabilities,define what mediasoup or a consumer endpoint can receive (e.g video codecs info)
  socket.on("getRtpCapabilites", (callback) => {
    callback(mediasoupState.router?.rtpCapabilities);
  });

  // creating a send transport when a user connects to socket
  socket.on("createSendTransport", async (callback) => {
    const transport = await mediasoupState.router?.createWebRtcTransport({
      listenIps: [
        {
          ip: "0.0.0.0", // this is the localip that mediasoup is runnning (onserver) -> localip(sameNetwork)
          announcedIp: "192.168.38.232", // this is the public ip that is sent to clients to connect back to server -> publicip
        },
        {
          ip: "127.0.0.1", // localhost (ipv4)
          announcedIp: "127.0.0.1",
        },
        {
          ip: "::1", //locahost (ipv6)
          announcedIp: "::1",
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    if (transport) {
      mediasoupState.transports.set(socket.id, transport);
      callback({
        id: transport?.id,
        iceParameters: transport.iceParameters, // include information like the ICE username fragment and password.
        iceCandidates: transport.iceCandidates, // these are network ip addresses and ports with protocols used to connect
        dtlsParameters: transport.dtlsParameters, // (Datagram Transport Layer Security) provides security and encryption for media streams
      });

      // Handle dtls
      // dtls is required to establish a connection securly btw peers
      // each side must exchange dtls parameters to make a handshake
      socket.on(
        "send-transport-connect",
        async ({ dtlsParameters }, callback) => {
          try {
            // add a plainTransport here. Retrieves the transport from the server memory.(optional)
            const sendTransport = mediasoupState.transports.get(transport.id);
            await sendTransport?.connect({ dtlsParameters }); // dtls is security layer for udp, .eg tls for tcp/http layer
            callback();
          } catch (error) {
            console.log("Transport connect error", error);
          }
        },
      );

      // rtpParameters => this describes the media sent by producer to mediasoup or mediasoup to consumer
      socket.on(
        "transport-produce",
        async ({ kind, rtpParameters }, callback) => {
          console.log("(server)here in produce");
          const producer = await transport.produce({ kind, rtpParameters });

          mediasoupState.producers.set(socket.id, producer);
          socket.emit("newproducer", { producerId: producer.id });
          callback({ id: producer.id });
        },
      );
    } else {
      console.log("Could not create transport(server)");
    }
  });

  // creating a receive transport (for consumers)
  socket.on("createRecvTransport", async (callback) => {
    const transport = await mediasoupState.router?.createWebRtcTransport({
      listenIps: [
        {
          ip: "0.0.0.0", // listen on all available networks
          announcedIp: "192.168.38.232",
        },
        {
          ip: "127.0.0.1", // localhost (ipv4)
          announcedIp: "127.0.0.1",
        },
        {
          ip: "::1", //locahost (ipv6)
          announcedIp: "::1",
        },
      ],
      enableTcp: true,
      enableUdp: true,
      preferUdp: true,
    });

    if (transport) {
      mediasoupState.transports.set(socket.id, transport);
      callback({
        id: transport?.id,
        iceParameters: transport.iceParameters, // include information like the ICE username fragment and password.
        iceCandidates: transport.iceCandidates, // these are network ip addresses and ports with protocols used to connect
        dtlsParameters: transport.dtlsParameters, // (Datagram Transport Layer Security) provides security and encryption for media streams
      });

      // Handle dtls
      // dtls is required to establish a connection securly btw peers
      // each side must exchange dtls parameters to make a handshake
      socket.on(
        "recv-transport-connect",
        async ({ dtlsParameters }, callback) => {
          try {
            // add a plainTransport here. Retrieves the transport from the server memory.(optional)
            const recvTransport = mediasoupState.transports.get(transport.id);

            await recvTransport?.connect({ dtlsParameters }); // dtls is security layer for udp, .eg tls for tcp/http layer
            callback();
          } catch (error) {
            console.log("error", error);
          }
        },
      );

      socket.on(
        "transport-consume",
        async ({ producerId, rtpCapabilities }, callback) => {
          try {
            const router = mediasoupState.router;
            const transport = mediasoupState.transports.get(socket.id);

            if (!router || !transport) {
              return callback({ error: "Router or transport not found" });
            }

            if (!router.canConsume({ producerId, rtpCapabilities })) {
              return callback({ error: "Cannot Consume" });
            }

            const consumer = await transport.consume({
              producerId,
              rtpCapabilities,
              paused: false, // can be true if you want to pause initially
            });

            callback({
              id: consumer.id,
              producerId,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
              // type: consumer.type,
              // appData: consumer.appData,
              // producerPaused: consumer.producerPaused,
            });
          } catch (error) {
            console.log("error in transport-consume", error);
          }
        },
      );

      socket.on(
        "transport-consume",
        async (
          {
            transportId,
            producerId,
            rtpCapabilites,
          }: {
            rtpCapabilites: mediasoup.types.RtpCapabilities;
            transportId: string;
            producerId: string;
          },
          callback,
        ) => {
          try {
            console.log("backend producer id ", producerId);
            //k const producer = mediasoupState.producers.get(socket.id)
            // const producer = Array.from(
            // con
            //   mediasoupState.producers.switch).producer.filter((prod) => prod.id !== socket.id);
            // const producerId = Array.from(
            //   mediasoupState.producers.keys(),
            // ).filter((prod: any) => prod !== socket.id);

            // const producer = mediasoupState.producers.get(producerId[0]);

            // console.log("here producer ", producer);
            // if (!producer) {
            //   throw new Error("No producer available");
            // }
            //
            // create consumer
            const consumer = await transport.consume({
              producerId: producerId,
              rtpCapabilities: rtpCapabilites,
              paused: false, // true if you want to start paused
            });

            mediasoupState.consumers.set(socket.id, consumer);

            callback({
              id: consumer.id,
              producerId: consumer.producerId,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
            });

            socket.on("consume-resume", async (callback) => {
              const consumer = mediasoupState.consumers.get(socket.id);
              if (consumer) {
                await consumer.resume();
                callback();
              }
            });
          } catch (error) {
            console.log("error", error);
          }
        },
      );
    } else {
      console.log("Could not create transport(server)");
    }
  });
});

export function startSocketServer() {
  server.listen(8080, () => {
    console.log("socket server listening on port 8080");
  });
}
