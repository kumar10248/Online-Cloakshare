const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hostName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  guestName: {
    type: String,
    default: null,
    trim: true,
    maxlength: 50
  },
  hostSocketId: {
    type: String,
    default: null
  },
  guestSocketId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'connected', 'ended'],
    default: 'waiting'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 7200 } // Auto-delete after 2 hours
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messages: [{
    senderId: {
      type: String,
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'file', 'emoji', 'system'],
      default: 'text'
    },
    content: {
      type: String,
      required: true
    },
    fileName: String,
    fileSize: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  callSession: {
    isActive: {
      type: Boolean,
      default: false
    },
    callType: {
      type: String,
      enum: ['voice', 'video'],
      default: null
    },
    initiator: String,
    startTime: Date,
    endTime: Date
  }
});

// Indexes for performance
ChatRoomSchema.index({ roomId: 1 });
ChatRoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });
ChatRoomSchema.index({ lastActivity: 1 });

// Methods
ChatRoomSchema.methods.addMessage = function(senderId, senderName, type, content, fileName = null, fileSize = null) {
  this.messages.push({
    senderId,
    senderName,
    type,
    content,
    fileName,
    fileSize,
    timestamp: new Date()
  });
  this.lastActivity = new Date();
  return this.save();
};

ChatRoomSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

ChatRoomSchema.methods.startCall = function(callType, initiatorId) {
  this.callSession = {
    isActive: true,
    callType,
    initiator: initiatorId,
    startTime: new Date(),
    endTime: null
  };
  this.lastActivity = new Date();
  return this.save();
};

ChatRoomSchema.methods.endCall = function() {
  if (this.callSession && this.callSession.isActive) {
    this.callSession.isActive = false;
    this.callSession.endTime = new Date();
    this.lastActivity = new Date();
    return this.save();
  }
};

// Static methods
ChatRoomSchema.statics.generateRoomId = function() {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

ChatRoomSchema.statics.findAvailableRoom = async function(roomId) {
  return this.findOne({ roomId, status: { $in: ['waiting', 'connected'] } });
};

ChatRoomSchema.statics.cleanupInactiveRooms = async function() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes
  return this.deleteMany({
    lastActivity: { $lt: cutoff },
    status: { $ne: 'connected' }
  });
};

const ChatRoom = mongoose.model('ChatRoom', ChatRoomSchema);

module.exports = ChatRoom;