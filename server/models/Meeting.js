const mongoose = require('mongoose');

const MeetingParticipantSchema = new mongoose.Schema({
  odedId: String,
  userName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  isHost: {
    type: Boolean,
    default: false
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  isVideoOff: {
    type: Boolean,
    default: false
  }
});

const MeetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  meetingName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  hostName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  hostSocketId: {
    type: String,
    default: null
  },
  participants: [MeetingParticipantSchema],
  maxParticipants: {
    type: Number,
    default: 8,
    max: 12
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended'],
    default: 'waiting'
  },
  meetingType: {
    type: String,
    enum: ['video', 'audio'],
    default: 'video'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 14400 } // Auto-delete after 4 hours
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messages: [{
    senderId: String,
    senderName: String,
    type: {
      type: String,
      enum: ['text', 'system'],
      default: 'text'
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
});

// Indexes
MeetingSchema.index({ meetingId: 1 });
MeetingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14400 });
MeetingSchema.index({ lastActivity: 1 });

// Methods
MeetingSchema.methods.addParticipant = function(socketId, userName, isHost = false) {
  // Check if already in meeting
  const existingParticipant = this.participants.find(p => p.socketId === socketId);
  if (existingParticipant) {
    return this;
  }

  // Check max participants
  if (this.participants.length >= this.maxParticipants) {
    throw new Error('Meeting is full');
  }

  this.participants.push({
    socketId,
    userName,
    isHost,
    joinedAt: new Date()
  });

  if (this.status === 'waiting' && this.participants.length > 0) {
    this.status = 'active';
  }

  this.lastActivity = new Date();
  return this.save();
};

MeetingSchema.methods.removeParticipant = function(socketId) {
  this.participants = this.participants.filter(p => p.socketId !== socketId);
  
  // End meeting if no participants
  if (this.participants.length === 0) {
    this.status = 'ended';
  }
  
  this.lastActivity = new Date();
  return this.save();
};

MeetingSchema.methods.addMessage = function(senderId, senderName, type, content) {
  this.messages.push({
    senderId,
    senderName,
    type,
    content,
    timestamp: new Date()
  });
  this.lastActivity = new Date();
  return this.save();
};

MeetingSchema.methods.getParticipantList = function() {
  return this.participants.map(p => ({
    socketId: p.socketId,
    userName: p.userName,
    isHost: p.isHost,
    isMuted: p.isMuted,
    isVideoOff: p.isVideoOff
  }));
};

// Static methods
MeetingSchema.statics.generateMeetingId = function() {
  // Generate 6-digit meeting ID
  return Math.floor(100000 + Math.random() * 900000).toString();
};

MeetingSchema.statics.findActiveMeeting = async function(meetingId) {
  return this.findOne({ meetingId, status: { $in: ['waiting', 'active'] } });
};

MeetingSchema.statics.cleanupInactiveMeetings = async function() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
  return this.deleteMany({
    lastActivity: { $lt: cutoff },
    status: 'ended'
  });
};

const Meeting = mongoose.model('Meeting', MeetingSchema);

module.exports = Meeting;
