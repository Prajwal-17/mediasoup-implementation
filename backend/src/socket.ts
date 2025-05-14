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
  })

  // creating a send transport when a user connects to socket
  socket.on("createSendTransport", async (callback) => {
    const transport = await mediasoupState.router?.createWebRtcTransport({
      listenInfos: [
        {
          protocol: "udp",
          ip: "0.0.0.0"
        },
        {
          protocol: "udp",
          ip: "::"
        }
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

      socket.on("transport-produce", async ({ kind, rtpParameters }, callback) => {
        const producer = await transport.produce({ kind, rtpParameters });

        producer.on("score", (score) => {
          console.log("Media score:", score);
          // If score is > 0, packets are being received
        });
        mediasoupState.producers.set(socket.id, producer);
        callback({ id: producer.id });
      });


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