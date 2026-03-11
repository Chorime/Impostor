const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const fs = require("fs")

const words = JSON.parse(fs.readFileSync("words.json"))

app.use(express.static("public"))

let rooms = {}

io.on("connection", socket => {

    socket.on("createRoom", ({name}) => {

    let code = Math.random().toString(36).substring(2,6).toUpperCase()

    rooms[code] = {
        host: socket.id,
        players:[{id:socket.id,name}]
    }

    socket.join(code)

    socket.emit("roomCreated", code)

    io.to(code).emit("playerList", {
    players: rooms[code].players,
    host: rooms[code].host
    })
    })
    

    socket.on("joinRoom", ({code,name}) => {

    if(!rooms[code]) return

    let room = rooms[code]

    // prevent duplicate joins
    let alreadyJoined = room.players.find(p => p.id === socket.id)

    if(alreadyJoined) return

    room.players.push({id:socket.id,name})

    socket.join(code)

    socket.emit("joinedRoom", code)

    io.to(code).emit("playerList", {
    players: rooms[code].players,
    host: rooms[code].host
    })
    })
    socket.on("startGame", code => {

        let room = rooms[code]
        
        let pair = words[Math.floor(Math.random()*words.length)]

        let impostorIndex = Math.floor(Math.random()*room.players.length)

        room.players.forEach((p,i)=>{

            if(i===impostorIndex){
                io.to(p.id).emit("role", {
                    type:"impostor",
                    word:pair.impostorWord,
                    category:pair.category
                })
            }else{
                io.to(p.id).emit("role", {
                    type:"player",
                    word:pair.word,
                    category:pair.category
                })
            }

        })
        
    })

    socket.on("restartGame",(code)=>{

    let room = rooms[code]
    if(!room) return

    io.to(code).emit("gameRestarted")

    })

    socket.on("disconnect", () => {

    for (let code in rooms) {

        let room = rooms[code]

        let index = room.players.findIndex(p => p.id === socket.id)

        if(index !== -1){

            room.players.splice(index,1)

            // if host left choose new host
            if(room.host === socket.id){

                if(room.players.length > 0){
                    room.host = room.players[0].id
                }

            }

            // delete empty room
            if(room.players.length === 0){
                delete rooms[code]
                return
            }

            io.to(code).emit("playerList", {
                players: room.players,
                host: room.host
            })

        }

    }

    })

})

const PORT = process.env.PORT || 3000

server.listen(PORT, ()=>console.log("Running"))