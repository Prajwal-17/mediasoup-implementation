# Socket.io

### Cheatsheet - [Socket.io CheatSheet](https://socket.io/docs/v4/emit-cheatsheet/)

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
io.emit("eventname",msgvalue)

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
