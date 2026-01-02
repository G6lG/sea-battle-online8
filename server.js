const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Статические файлы
app.use(express.static(path.join(__dirname)));

// Хранилище данных
const users = new Map();
const rooms = new Map();
const games = new Map();

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);
    
    // Регистрация пользователя
    socket.on('register', (data) => {
        const user = {
            id: Date.now().toString(),
            socketId: socket.id,
            username: data.username,
            email: data.email,
            rating: 1000,
            wins: 0,
            losses: 0,
            friends: [],
            status: 'online'
        };
        
        users.set(socket.id, user);
        socket.emit('registered', { success: true, user });
        
        // Уведомляем всех о новом пользователе
        broadcastOnlineUsers();
    });
    
    // Создание комнаты
    socket.on('create_room', (data) => {
        const user = users.get(socket.id);
        if (!user) return;
        
        const roomId = generateRoomId();
        const room = {
            id: roomId,
            name: data.name || `Комната ${roomId}`,
            creator: user,
            players: [user],
            maxPlayers: 2,
            isPrivate: data.isPrivate || false,
            status: 'waiting'
        };
        
        rooms.set(roomId, room);
        socket.join(roomId);
        
        socket.emit('room_created', { roomId, room });
        console.log(`Комната ${roomId} создана пользователем ${user.username}`);
    });
    
    // Присоединение к комнате
    socket.on('join_room', (data) => {
        const user = users.get(socket.id);
        const room = rooms.get(data.roomId);
        
        if (!user || !room) return;
        
        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', { message: 'Комната заполнена' });
            return;
        }
        
        room.players.push(user);
        socket.join(data.roomId);
        
        io.to(data.roomId).emit('player_joined', {
            player: user,
            room: room
        });
        
        console.log(`Пользователь ${user.username} присоединился к комнате ${data.roomId}`);
    });
    
    // Отключение
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            user.status = 'offline';
            broadcastOnlineUsers();
        }
        users.delete(socket.id);
    });
});

// Вспомогательные функции
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastOnlineUsers() {
    const onlineUsers = Array.from(users.values())
        .filter(u => u.status === 'online')
        .map(u => ({ id: u.id, username: u.username, rating: u.rating }));
    
    io.emit('users_online', onlineUsers);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});