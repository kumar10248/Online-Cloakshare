const { Server } = require('socket.io');
const ChatRoom = require('../models/Chat');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

class ChatSocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:5174", "https://cloakshare.devashish.top", "https://online-cloakshare-client.vercel.app"],
        methods: ["GET", "POST"],
        credentials: true
      },
      maxHttpBufferSize: 10 * 1024 * 1024 // 10MB
    });

    this.connectedUsers = new Map(); // socketId -> { roomId, userId, userName }
    this.activeRooms = new Map(); // roomId -> { host, guest, callSession }
    
    this.setupSocketHandlers();
    this.startCleanupJob();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Create new chat room
      socket.on('create-room', async (data) => {
        try {
          const { userName } = data;
          
          if (!userName || userName.trim().length === 0) {
            socket.emit('error', { message: 'User name is required' });
            return;
          }

          // Generate unique room ID
          let roomId;
          let existingRoom;
          do {
            roomId = ChatRoom.generateRoomId();
            existingRoom = await ChatRoom.findAvailableRoom(roomId);
          } while (existingRoom);

          // Create new chat room
          const chatRoom = new ChatRoom({
            roomId,
            hostName: userName.trim(),
            hostSocketId: socket.id
          });

          await chatRoom.save();

          // Store user info
          this.connectedUsers.set(socket.id, {
            roomId,
            userId: socket.id,
            userName: userName.trim(),
            role: 'host'
          });

          // Join socket room
          socket.join(roomId);

          console.log(`Chat room created: ${roomId} by ${userName}`);
          
          socket.emit('room-created', {
            roomId,
            userName: userName.trim(),
            role: 'host'
          });

        } catch (error) {
          console.error('Error creating room:', error);
          socket.emit('error', { message: 'Failed to create room' });
        }
      });

      // Join existing chat room
      socket.on('join-room', async (data) => {
        try {
          const { roomId, userName } = data;

          if (!roomId || !userName || userName.trim().length === 0) {
            socket.emit('error', { message: 'Room ID and user name are required' });
            return;
          }

          // Find room
          const chatRoom = await ChatRoom.findAvailableRoom(roomId);
          
          if (!chatRoom) {
            socket.emit('error', { message: 'Room not found or already full' });
            return;
          }

          if (chatRoom.status === 'connected') {
            socket.emit('error', { message: 'Room is already full' });
            return;
          }

          // Update room with guest info
          chatRoom.guestName = userName.trim();
          chatRoom.guestSocketId = socket.id;
          chatRoom.status = 'connected';
          await chatRoom.save();

          // Store user info
          this.connectedUsers.set(socket.id, {
            roomId,
            userId: socket.id,
            userName: userName.trim(),
            role: 'guest'
          });

          // Join socket room
          socket.join(roomId);

          // Add system message
          await chatRoom.addMessage('system', 'System', 'system', `${userName.trim()} joined the chat`);

          console.log(`User ${userName} joined room ${roomId}`);

          // Send confirmation to the joiner
          socket.emit('room-joined', {
            roomId,
            userName: userName.trim(),
            role: 'guest',
            hostName: chatRoom.hostName,
            guestName: chatRoom.guestName,
            status: chatRoom.status,
            messages: chatRoom.messages
          });

          // Notify both users
          this.io.to(roomId).emit('user-joined', {
            roomId,
            hostName: chatRoom.hostName,
            guestName: chatRoom.guestName,
            status: chatRoom.status,
            messages: chatRoom.messages
          });

        } catch (error) {
          console.error('Error joining room:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // Handle text messages
      socket.on('send-message', async (data) => {
        try {
          const { message } = data;
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          if (!message || message.trim().length === 0) {
            socket.emit('error', { message: 'Message cannot be empty' });
            return;
          }

          // Find room and add message
          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId, status: 'connected' });
          
          if (!chatRoom) {
            socket.emit('error', { message: 'Room not found or not connected' });
            return;
          }

          await chatRoom.addMessage(user.userId, user.userName, 'text', message.trim());

          // Broadcast message to room
          this.io.to(user.roomId).emit('new-message', {
            senderId: user.userId,
            senderName: user.userName,
            type: 'text',
            content: message.trim(),
            timestamp: new Date()
          });

        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle emoji messages
      socket.on('send-emoji', async (data) => {
        try {
          const { emoji } = data;
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          if (!emoji) {
            socket.emit('error', { message: 'Emoji is required' });
            return;
          }

          // Find room and add emoji message
          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId, status: 'connected' });
          
          if (!chatRoom) {
            socket.emit('error', { message: 'Room not found or not connected' });
            return;
          }

          await chatRoom.addMessage(user.userId, user.userName, 'emoji', emoji);

          // Broadcast emoji to room
          this.io.to(user.roomId).emit('new-message', {
            senderId: user.userId,
            senderName: user.userName,
            type: 'emoji',
            content: emoji,
            timestamp: new Date()
          });

        } catch (error) {
          console.error('Error sending emoji:', error);
          socket.emit('error', { message: 'Failed to send emoji' });
        }
      });

      // Handle file uploads
      socket.on('send-file', async (data) => {
        try {
          const { fileName, fileData, fileSize, fileType } = data;
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          if (!fileName || !fileData) {
            socket.emit('error', { message: 'File name and data are required' });
            return;
          }

          if (fileSize > 10 * 1024 * 1024) { // 10MB limit
            socket.emit('error', { message: 'File size exceeds 10MB limit' });
            return;
          }

          // Find room and add file message
          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId, status: 'connected' });
          
          if (!chatRoom) {
            socket.emit('error', { message: 'Room not found or not connected' });
            return;
          }

          await chatRoom.addMessage(
            user.userId, 
            user.userName, 
            'file', 
            fileData, // Base64 encoded file data
            fileName, 
            fileSize
          );

          // Broadcast file to room
          this.io.to(user.roomId).emit('new-message', {
            senderId: user.userId,
            senderName: user.userName,
            type: 'file',
            content: fileData,
            fileName,
            fileSize,
            fileType,
            timestamp: new Date()
          });

        } catch (error) {
          console.error('Error sending file:', error);
          socket.emit('error', { message: 'Failed to send file' });
        }
      });

      // Handle voice call initiation
      socket.on('initiate-voice-call', async (data) => {
        try {
          console.log('Voice call initiation received');
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            console.log('User not found for voice call');
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId, status: 'connected' });
          
          if (!chatRoom) {
            console.log('Room not found for voice call');
            socket.emit('error', { message: 'Room not found or not connected' });
            return;
          }

          if (chatRoom.callSession.isActive) {
            console.log('Call already in progress');
            socket.emit('error', { message: 'Call is already in progress' });
            return;
          }

          await chatRoom.startCall('voice', user.userId);
          console.log(`Voice call started by ${user.userName} in room ${user.roomId}`);

          // Notify the other user
          socket.to(user.roomId).emit('incoming-voice-call', {
            callerId: user.userId,
            callerName: user.userName
          });

          socket.emit('call-initiated', { callType: 'voice' });

        } catch (error) {
          console.error('Error initiating voice call:', error);
          socket.emit('error', { message: 'Failed to initiate voice call' });
        }
      });

      // Handle video call initiation
      socket.on('initiate-video-call', async (data) => {
        try {
          console.log('Video call initiation received');
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            console.log('User not found for video call');
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId, status: 'connected' });
          
          if (!chatRoom) {
            console.log('Room not found for video call');
            socket.emit('error', { message: 'Room not found or not connected' });
            return;
          }

          if (chatRoom.callSession.isActive) {
            console.log('Call already in progress');
            socket.emit('error', { message: 'Call is already in progress' });
            return;
          }

          await chatRoom.startCall('video', user.userId);
          console.log(`Video call started by ${user.userName} in room ${user.roomId}`);

          // Notify the other user
          socket.to(user.roomId).emit('incoming-video-call', {
            callerId: user.userId,
            callerName: user.userName
          });

          socket.emit('call-initiated', { callType: 'video' });

        } catch (error) {
          console.error('Error initiating video call:', error);
          socket.emit('error', { message: 'Failed to initiate video call' });
        }
      });

      // Handle call acceptance
      socket.on('accept-call', async (data) => {
        try {
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId, status: 'connected' });
          
          if (!chatRoom || !chatRoom.callSession.isActive) {
            socket.emit('error', { message: 'No active call found' });
            return;
          }

          const callType = chatRoom.callSession.callType;
          const callerId = chatRoom.callSession.initiatedBy;

          // Notify both users that call is accepted
          this.io.to(user.roomId).emit('call-accepted', {
            callType: callType,
            acceptedBy: user.userName,
            participants: [
              { id: chatRoom.hostSocketId, name: chatRoom.hostName },
              { id: chatRoom.guestSocketId, name: chatRoom.guestName }
            ]
          });

          // Tell the CALLER to send the WebRTC offer now
          // The caller is the one who initiated the call
          const callerSocketId = callerId === chatRoom.hostSocketId ? chatRoom.hostSocketId : chatRoom.guestSocketId;
          this.io.to(callerSocketId).emit('send-webrtc-offer', {
            callType: callType
          });

          console.log(`Call accepted by ${user.userName}, telling caller to send offer`);

        } catch (error) {
          console.error('Error accepting call:', error);
          socket.emit('error', { message: 'Failed to accept call' });
        }
      });

      // Handle call rejection/end
      socket.on('reject-call', async (data) => {
        try {
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId, status: 'connected' });
          
          if (!chatRoom) {
            socket.emit('error', { message: 'Room not found' });
            return;
          }

          await chatRoom.endCall();

          // Notify both users
          this.io.to(user.roomId).emit('call-ended', {
            reason: 'rejected',
            endedBy: user.userName
          });

        } catch (error) {
          console.error('Error rejecting call:', error);
          socket.emit('error', { message: 'Failed to reject call' });
        }
      });

      // Handle explicit call end
      socket.on('end-call', async (data) => {
        try {
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId, status: 'connected' });
          
          if (!chatRoom) {
            socket.emit('error', { message: 'Room not found' });
            return;
          }

          await chatRoom.endCall();

          // Notify both users
          this.io.to(user.roomId).emit('call-ended', {
            reason: 'ended',
            endedBy: user.userName
          });

          console.log(`Call ended by ${user.userName} in room ${user.roomId}`);

        } catch (error) {
          console.error('Error ending call:', error);
          socket.emit('error', { message: 'Failed to end call' });
        }
      });

      // Handle WebRTC signaling for calls
      socket.on('webrtc-offer', (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          console.log('Relaying WebRTC offer');
          socket.to(user.roomId).emit('webrtc-offer', {
            offer: data.offer,
            callType: data.callType,
            from: socket.id
          });
        }
      });

      socket.on('webrtc-answer', (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          console.log('Relaying WebRTC answer');
          socket.to(user.roomId).emit('webrtc-answer', {
            answer: data.answer,
            from: socket.id
          });
        }
      });

      socket.on('webrtc-ice-candidate', (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          console.log('Relaying ICE candidate');
          socket.to(user.roomId).emit('webrtc-ice-candidate', {
            candidate: data.candidate,
            from: socket.id
          });
        }
      });

      socket.on('call-signal', (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          socket.to(user.roomId).emit('call-signal', {
            signal: data.signal,
            from: socket.id
          });
        }
      });

      // Handle typing indicators
      socket.on('typing-start', () => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          socket.to(user.roomId).emit('user-typing', {
            userId: user.userId,
            userName: user.userName,
            isTyping: true
          });
        }
      });

      socket.on('typing-stop', () => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          socket.to(user.roomId).emit('user-typing', {
            userId: user.userId,
            userName: user.userName,
            isTyping: false
          });
        }
      });

      // Handle chat termination
      socket.on('terminate-chat', async () => {
        try {
          const user = this.connectedUsers.get(socket.id);

          if (!user) {
            socket.emit('error', { message: 'You are not in a room' });
            return;
          }

          const chatRoom = await ChatRoom.findOne({ roomId: user.roomId });
          
          if (chatRoom) {
            chatRoom.status = 'ended';
            await chatRoom.save();

            // Add system message
            await chatRoom.addMessage('system', 'System', 'system', `Chat ended by ${user.userName}`);

            // Notify both users
            this.io.to(user.roomId).emit('chat-terminated', {
              terminatedBy: user.userName,
              reason: 'user-action'
            });

            // Clean up
            this.cleanupRoom(user.roomId);
          }

        } catch (error) {
          console.error('Error terminating chat:', error);
          socket.emit('error', { message: 'Failed to terminate chat' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        try {
          const user = this.connectedUsers.get(socket.id);
          
          if (user) {
            console.log(`User ${user.userName} disconnected from room ${user.roomId}`);
            
            const chatRoom = await ChatRoom.findOne({ roomId: user.roomId });
            
            if (chatRoom) {
              // Add system message
              await chatRoom.addMessage('system', 'System', 'system', `${user.userName} left the chat`);

              // Notify other user
              socket.to(user.roomId).emit('user-disconnected', {
                userId: user.userId,
                userName: user.userName
              });

              // End any active call
              if (chatRoom.callSession.isActive) {
                await chatRoom.endCall();
                this.io.to(user.roomId).emit('call-ended', {
                  reason: 'disconnection',
                  endedBy: user.userName
                });
              }

              // Update room status if needed
              if (chatRoom.status === 'connected') {
                chatRoom.status = 'ended';
                await chatRoom.save();
              }
            }

            // Clean up
            this.connectedUsers.delete(socket.id);
            this.cleanupRoom(user.roomId);
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    });
  }

  cleanupRoom(roomId) {
    // Remove room from active rooms
    this.activeRooms.delete(roomId);
    
    // Remove all users from this room
    for (const [socketId, user] of this.connectedUsers.entries()) {
      if (user.roomId === roomId) {
        this.connectedUsers.delete(socketId);
      }
    }
  }

  startCleanupJob() {
    // Clean up inactive rooms every 10 minutes
    setInterval(async () => {
      try {
        const result = await ChatRoom.cleanupInactiveRooms();
        if (result.deletedCount > 0) {
          console.log(`Cleaned up ${result.deletedCount} inactive rooms`);
        }
      } catch (error) {
        console.error('Error in cleanup job:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }

  getActiveRoomsCount() {
    return this.activeRooms.size;
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}

module.exports = ChatSocketService;
