import { Server } from "socket.io";
import { createServer } from "node:http";
import { mediasoupState } from ".";
import { v4 as uuidv4 } from "uuid"

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// setInterval(() => {
//   console.log("producers", mediasoupState.producers.keys());
//   console.log("consumers", mediasoupState.consumers.keys());
//   console.log("transports", mediasoupState.transports.keys())
// }, 3000);

io.on("connection", (socket) => {
  console.log("User connected to socket server");

  // send router rtpCapabilites to client for further negotiation
  // RTP capabilities,define what mediasoup or a consumer endpoint can receive (e.g video codecs info, headers, fecMechanisms, rtcpFeedback)
  socket.on("getRtpCapabilites", (callback) => {
    callback(mediasoupState.router?.rtpCapabilities);
  });

  // creating a send transport when a user connects to socket
  socket.on("createSendTransport", async (callback) => {
    const transport = await mediasoupState.router?.createWebRtcTransport({
      listenIps: [
        {
          ip: "0.0.0.0", // this is the localip that mediasoup is runnning (onserver) -> localip(sameNetwork)
          // announcedIp: "192.168.38.232", // this is the public ip that is sent to clients to connect back to server -> publicip
        },
        {
          ip: "127.0.0.1", // localhost (ipv4)
          // announcedIp: "127.0.0.1",
        },
        {
          ip: "::1", //locahost (ipv6)
          // announcedIp: "::1",
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });


    if (transport) {
      const sendTransportId = `sendTransport_${uuidv4()}`
      mediasoupState.transports.set(sendTransportId, transport);
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
            const sendTransport = mediasoupState.transports.get(sendTransportId);
            await sendTransport?.connect({ dtlsParameters }); // dtls is security layer for udp, .eg tls for tcp/http layer
            callback();
          } catch (error) {
            console.log("Transport connect error", error);
          }
        },
      );

      transport.on("icestatechange", (state) => {
        console.log(`ICE state (${transport.id}):`, state);
      });
      transport.on("dtlsstatechange", (state) => {
        if (state === "failed") console.log("DTLS failed");
      });

      // rtpParameters => this describes the media sent by producer to mediasoup or mediasoup to consumer
      socket.on(
        "transport-produce",
        async ({ kind, rtpParameters }, callback) => {
          try {
            const producer = await transport.produce({ kind, rtpParameters });

            const producerId = `producer_${uuidv4()}`
            mediasoupState.producers.set(producerId, producer);

            // broadcast to all other sockets except sender
            socket.broadcast.emit("new-producer", {
              producerId: producer.id,
              producerSocketId: socket.id,
            });
            callback({ id: producer.id });
          } catch (error) {
            console.log("Error in transport-produce event", error)
          }
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
          // announcedIp: "192.168.38.232",
        },
        {
          ip: "127.0.0.1", // localhost (ipv4)
          // announcedIp: "127.0.0.1",
        },
        {
          ip: "::1", //locahost (ipv6)
          // announcedIp: "::1",
        },
      ],
      enableTcp: true,
      enableUdp: true,
      preferUdp: true,
    });

    if (transport) {
      const recvTransportId = `recvTransport_${uuidv4()}`
      mediasoupState.transports.set(recvTransportId, transport);

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
            const recvTransport = mediasoupState.transports.get(recvTransportId);
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
            const recvTransport = mediasoupState.transports.get(recvTransportId);
            console.log(
              "Can consume:",
              router?.canConsume({ producerId, rtpCapabilities }),
            );

            if (!router || !recvTransport) {
              return callback({ error: "Router or transport not found" });
            }

            if (!router.canConsume({ producerId, rtpCapabilities })) {
              return callback({ error: "Cannot Consume" });
            }

            const consumer = await recvTransport.consume({
              producerId,
              rtpCapabilities,
              paused: false, // can be true if you want to pause initially
            });

            mediasoupState.consumers.set(socket.id, consumer);

            callback({
              id: consumer.id,
              producerId,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
            });
          } catch (error) {
            console.log("error in transport-consume", error);
          }
        },
      );

      socket.on("consume-resume", async (callback) => {
        const consumer = mediasoupState.consumers.get(socket.id);
        if (consumer) {
          await consumer.resume();
        }
        callback("resumed");
      });
    } else {
      console.log("Could not create transport(server)");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const producer = mediasoupState.producers.get(socket.id);
    if (producer) {
      producer.close();
      mediasoupState.producers.delete(socket.id);
    }

    const consumer = mediasoupState.consumers.get(socket.id);
    if (consumer) {
      consumer.close();
      mediasoupState.consumers.delete(socket.id);
    }

    const transport = mediasoupState.transports.get(socket.id);
    if (transport) {
      transport.close();
      mediasoupState.transports.delete(socket.id);
    }
  });
});

export function startSocketServer() {
  server.listen(8080, () => {
    console.log("socket server listening on port 8080");
  });
}
