const express = require("express")
const http = require("http")
const WebSocket = require("ws")

const app = express()

const server = http.createServer(app)

const wss = new WebSocket.Server({ server })

const rooms = {}

wss.on("connection", ws => {

  console.log("DEVICE CONNECT")

  ws.on("message", message => {

    try {

      const data =
      JSON.parse(message)

      const room =
      data.room

      if(!rooms[room]){
        rooms[room] = []
      }

      if(!rooms[room].includes(ws)){
        rooms[room].push(ws)
      }

      rooms[room].forEach(client => {

        if(
          client !== ws &&
          client.readyState === WebSocket.OPEN
        ){
          client.send(message.toString())
        }

      })

    } catch(err){
      console.log(err)
    }

  })

})

app.get("/",(req,res)=>{
  res.send("JAWIR WS ONLINE")
})

server.listen(8080,()=>{
  console.log("RUNNING 8080")
})
