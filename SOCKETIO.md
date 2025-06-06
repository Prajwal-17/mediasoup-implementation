# Socket.io

### Cheatsheet - [Socket.io CheatSheet](https://socket.io/docs/v4/emit-cheatsheet/)
#### Promise Based - (https://socket.io/docs/v4/tutorial/api-overview#with-a-promise)

### Initial Connection

```
// Server-side
io.on('connection', (socket) => {
});

// Client-side
socket.on("connect",()=>{

})
```

### Sending and Receiving

```
// Server-side
io.emit("eventname",msgvalue)

// Client-side
socket.on("eventname",(msg)=>{
  console.log(msg)
})

```

### Send Msg to everyone expect you

- only applicable for emit event

```
socket.broadcast.emit('eventname',msgvalue)
```

### Passing Params

- only applicable for emit event

```
socket.emit("eventname",{params})
```

## Acknowledgement

Acknowledgement is a way to get response from the other side when you send a message. Similar to request-resonse model

### Callback based

- Client Side

```
socket.emit("eventname",{params},(response)=>{

})
```

- Server Side

```
socket.on("eventname",(data,callback)=>{  // access params

callback()  // send back a response
})
```

### Rooms

- rooms are purely server side concept, client side does not contain them

```
socket.join("roomid")  // to join a room
```

- emit events to a particular room

```
socket.to("roomId").emit("eventname",msgvalue)
```

### Namespaces

- used to split logic of the socket code

```
// create a namespace (server side)
const chatNamespace = io.of("/chat");

// (client side)
const chatSocket = io("https://example.com/chat"); // cross-origin
const chatSocket = io("/chat") // same-origin

```

- emit event to namespace

```
chatNamespace.to("roomid").emit("eventname",msgvalue)
```
