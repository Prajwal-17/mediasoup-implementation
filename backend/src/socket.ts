import { Server } from "socket.io";
import { createServer } from "node:http"
import * as mediasoup from "mediasoup"
import { mediasoupState } from ".";

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*"
  }
})

io.on("connection", (socket) => {
  console.log("user connected to socket server")

  // send router rtpCapabilites to client for further negotiation
  socket.on("getRtpCapabilites", (callback) => {
    callback(mediasoupState.router?.rtpCapabilities)
    // console.log(mediasoupState.router?.rtpCapabilities)
  })

  // creating a send transport when a user connects to socket
  socket.on("createSendTransport", async (callback) => {
    const transport = await mediasoupState.router?.createWebRtcTransport({
      listenIps: [
        {
          ip: '192.168.38.232', // my ip (ipv4)
          announcedIp: '192.168.38.232'
        },
        {
          ip: "127.0.0.1", // localhost (ipv4)
          announcedIp: "127.0.0.1"
        }, {
          ip: "::1", //locahost (ipv6)
          announcedIp: "::1"
        }
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true
    });

    if (transport) {
      mediasoupState.transports.set(socket.id, transport)
      callback({
        id: transport?.id,
        iceParameters: transport.iceParameters,  // include information like the ICE username fragment and password.
        iceCandidates: transport.iceCandidates,  // these are network ip addresses and ports with protocols used to connect
        dtlsParameters: transport.dtlsParameters // (Datagram Transport Layer Security) provides security and encryption for media streams
      })
      // console.log('Transport created:', transport.id);


      // Handle dtls
      // dtls is required to establish a connection securly btw peers
      // each side must exchange dtls parameters to make a handshake
      socket.on("transport-connect", async ({ dtlsParameters }, callback) => {
        try {
          await transport.connect({ dtlsParameters })   // dtls is security layer for udp, .eg tls for tcp/http layer
          callback();
        } catch (error) {
          console.log("error", error)
        }
      });

      socket.on("transport-produce", async ({ kind, rtpParameters }, callback) => {
        const producer = await transport.produce({ kind, rtpParameters });

        // producer.on("score", (score) => {
        //   console.log("Media score:", score);
        //   // If score is > 0, packets are being received
        // });
        mediasoupState.producers.set(socket.id, producer);
        callback({ id: producer.id });
      });

    } else {
      console.log("Could not create transport(server)")
    }

  })

  // creating a receive transport (for consumers)
  socket.on("createRecvTransport", async (callback) => {
    const transport = await mediasoupState.router?.createWebRtcTransport({
      listenIps: [
        {
          ip: '0.0.0.0',
        },
        {
          ip: '::',
        },
      ],
      enableTcp: true,
      enableUdp: true,
      preferUdp: true
    })

    if (transport) {
      mediasoupState.transports.set(socket.id, transport)
      callback({
        id: transport?.id,
        iceParameters: transport.iceParameters,  // include information like the ICE username fragment and password.
        iceCandidates: transport.iceCandidates,  // these are network ip addresses and ports with protocols used to connect
        dtlsParameters: transport.dtlsParameters // (Datagram Transport Layer Security) provides security and encryption for media streams
      })

      // Handle dtls
      // dtls is required to establish a connection securly btw peers
      // each side must exchange dtls parameters to make a handshake
      socket.on("transport-connect", async ({ dtlsParameters }, callback) => {
        try {
          await transport.connect({ dtlsParameters })   // dtls is security layer for udp, .eg tls for tcp/http layer
          callback();
        } catch (error) {
          console.log("error", error)
        }
      });

      socket.on("consume", async ({ rtpCapabilites }, callback) => {
        try {
          const producer = Array.from(mediasoupState.producers.values())[0];

          if (!producer) {
            throw new Error("No producers available");
          }

          // check if the device can consume this producer

          //create consumer 
          const consumer = await transport.consume({
            producerId: producer.id,
            rtpCapabilities: rtpCapabilites,
            paused: false // or true if you want to start paused
          });

          mediasoupState.consumers.set(socket.id, consumer);

          callback({
            id: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters
          });


          // Handle consumer resume
          // socket.on("resume")

        } catch (error) {
          console.log("error", error)
        }
      })
    } else {
      console.log("Could not create transport(server)")
    }
  })
})


export function startSocketServer() {
  server.listen(8080, () => {
    console.log("socket server listening on port 8080")
  })
}