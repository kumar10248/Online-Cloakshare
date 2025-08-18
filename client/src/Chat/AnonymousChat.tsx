import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faComment,
  faPaperPlane,
  faUsers,
  faTimes,
  faPlus,
  faFileAlt,
  faPhone,
  faVideo,
  faDownload,
  faEyeSlash,
  faUserSecret,
  faSignOutAlt,
  faCopy,
  faFile,
  faImage,
  faFilePdf,
  faFileWord,
  faFileExcel
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './AnonymousChat.css';

// Types
interface Message {
  senderId: string;
  senderName: string;
  type: 'text' | 'file' | 'emoji' | 'system';
  content: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  timestamp: Date;
}

interface RoomInfo {
  roomId: string;
  hostName: string;
  guestName: string | null;
  status: 'waiting' | 'connected' | 'ended';
}

interface User {
  roomId: string;
  userName: string;
  role: 'host' | 'guest';
}

const AnonymousChat: React.FC = () => {
  // Socket and connection state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // User and room state
  const [user, setUser] = useState<User | null>(null);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // UI state
  const [isVisible, setIsVisible] = useState(false);
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // File handling
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Voice/Video call state
  const [isCallActive, setIsCallActive] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callerName: string; callType: 'voice' | 'video' } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);

  // Use remoteStream to avoid TypeScript warning
  React.useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize socket connection
  useEffect(() => {
    // Use different URLs for Socket.IO server
    const socketURL = import.meta.env.VITE_SOCKET_URL || 
                     import.meta.env.VITE_API_URL || 
                     'http://localhost:8000';
    
    console.log('Attempting to connect to Socket.IO server:', socketURL);
    
    const socketInstance = io(socketURL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      timeout: 20000,
      forceNew: true
    });

    socketInstance.on('connect', () => {
      console.log('Connected to chat server at:', socketURL);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from chat server');
      setIsConnected(false);
      setUser(null);
      setRoomInfo(null);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
      toast.error('Failed to connect to chat server. Please check your internet connection.');
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to chat server after', attemptNumber, 'attempts');
      setIsConnected(true);
      toast.success('Reconnected to chat server');
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Reconnection failed:', error);
      toast.error('Unable to reconnect to chat server');
    });

    // Chat events
    socketInstance.on('room-created', (data) => {
      setUser({ roomId: data.roomId, userName: data.userName, role: 'host' });
      setRoomInfo({ roomId: data.roomId, hostName: data.userName, guestName: null, status: 'waiting' });
      toast.success(`Room ${data.roomId} created! Share this code with someone to start chatting.`);
      setIsConnecting(false);
    });

    socketInstance.on('room-joined', (data) => {
      console.log('Room joined event received:', data);
      setUser({ roomId: data.roomId, userName: data.userName, role: 'guest' });
      setRoomInfo({
        roomId: data.roomId,
        hostName: data.hostName,
        guestName: data.guestName,
        status: data.status
      });
      setMessages(data.messages || []);
      toast.success(`Joined room ${data.roomId}! You can now start chatting.`);
      setIsConnecting(false);
    });

    socketInstance.on('user-joined', (data) => {
      console.log('User joined event received:', data);
      setRoomInfo(data);
      setMessages(data.messages || []);
      const guestName = data.guestName;
      
      // Update user role if needed
      if (user?.userName === guestName) {
        setUser(prev => prev ? { ...prev, role: 'guest' } : null);
      }
      
      toast.success(`${guestName} joined the chat! You can now start chatting.`);
      setIsConnecting(false);
    });

    socketInstance.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, { ...message, timestamp: new Date(message.timestamp) }]);
      
      // Show notification for file messages
      if (message.type === 'file') {
        toast.success(`${message.senderName} shared a file: ${message.fileName}`);
      }
    });

    socketInstance.on('user-typing', (data) => {
      setOtherUserTyping(data.isTyping);
    });

    socketInstance.on('user-disconnected', (data) => {
      toast.error(`${data.userName} left the chat`);
      setRoomInfo(prev => prev ? { ...prev, status: 'ended' } : null);
    });

    // Call events
    socketInstance.on('incoming-voice-call', (data) => {
      setIncomingCall({ ...data, callType: 'voice' });
    });

    socketInstance.on('incoming-video-call', (data) => {
      setIncomingCall({ ...data, callType: 'video' });
    });

    socketInstance.on('call-accepted', (data) => {
      setIsCallActive(true);
      // setCallType(data.callType);
      setIncomingCall(null);
      toast.success(`${data.callType} call started!`);
    });

    socketInstance.on('call-initiated', (data) => {
      console.log('Call initiated:', data);
      toast.success(`${data.callType} call initiated! Waiting for response...`);
    });

    socketInstance.on('call-ended', (data) => {
      setIsCallActive(false);
      setCallType(null);
      setIncomingCall(null);
      endCall();
      toast(`Call ended: ${data.reason}`);
    });

    // WebRTC signaling handlers
    socketInstance.on('webrtc-offer', async (data) => {
      console.log('Received WebRTC offer');
      await handleWebRTCOffer(data.offer, data.callType);
    });

    socketInstance.on('webrtc-answer', async (data) => {
      console.log('Received WebRTC answer');
      await handleWebRTCAnswer(data.answer);
    });

    socketInstance.on('webrtc-ice-candidate', async (data) => {
      console.log('Received ICE candidate');
      await handleICECandidate(data.candidate);
    });

    socketInstance.on('error', (data) => {
      console.error('Socket error:', data);
      toast.error(data.message || 'An error occurred');
      setIsConnecting(false);
    });

    socketInstance.on('chat-terminated', (data) => {
      toast.error(`Chat ended by ${data.terminatedBy}`);
      setUser(null);
      setRoomInfo(null);
      setMessages([]);
    });

    socketInstance.on('error', (data) => {
      toast.error(data.message);
      setIsConnecting(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create room
  const createRoom = () => {
    if (!userName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!socket || !isConnected) {
      toast.error('Not connected to chat server');
      return;
    }

    setIsConnecting(true);
    socket.emit('create-room', { userName: userName.trim() });
  };

  // Join room
  const joinRoom = () => {
    if (!userName.trim() || !roomId.trim()) {
      toast.error('Please enter your name and room code');
      return;
    }

    if (!socket || !isConnected) {
      toast.error('Not connected to chat server');
      return;
    }

    setIsConnecting(true);
    socket.emit('join-room', { roomId: roomId.trim(), userName: userName.trim() });
  };

  // Send message
  const sendMessage = () => {
    if (!currentMessage.trim() || !socket || !user) return;

    socket.emit('send-message', { message: currentMessage.trim() });
    setCurrentMessage('');
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('typing-stop');
    setIsTyping(false);
  };

  // Handle typing
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMessage(e.target.value);

    if (!socket || !user) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing-start');
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing-stop');
    }, 2000);
  };

  // Handle file upload
  const handleFileSelect = (file: File) => {
    if (!socket || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Set file for preview
    setSelectedFile(file);
  };

  // Send the selected file
  const sendFile = () => {
    if (!selectedFile || !socket) return;

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = reader.result as string;
      socket.emit('send-file', {
        fileName: selectedFile.name,
        fileData,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      });
    };
    reader.readAsDataURL(selectedFile);
    setSelectedFile(null);
  };

  // Cancel file selection
  const cancelFileSelection = () => {
    setSelectedFile(null);
  };

  // Download file
  const downloadFile = (message: Message) => {
    if (message.type !== 'file' || !message.content) return;

    try {
      // Ensure the content is a valid data URL
      let dataUrl = message.content;
      if (!dataUrl.startsWith('data:')) {
        // If it's just base64 without the data URL prefix, add it
        const mimeType = message.fileType || 'application/octet-stream';
        dataUrl = `data:${mimeType};base64,${dataUrl}`;
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = message.fileName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Downloading ${message.fileName}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  // Get file icon based on file type
  const getFileIcon = (fileName: string, fileType?: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (fileType?.startsWith('image/')) return faImage;
    if (extension === 'pdf') return faFilePdf;
    if (['doc', 'docx'].includes(extension || '')) return faFileWord;
    if (['xls', 'xlsx'].includes(extension || '')) return faFileExcel;
    
    return faFile;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && roomInfo?.hostName && roomInfo?.guestName) {
      handleFileSelect(files[0]);
    }
  };

  // Copy room ID
  const copyRoomId = () => {
    if (!user?.roomId) return;
    navigator.clipboard.writeText(user.roomId);
    toast.success('Room code copied to clipboard!');
  };

  // Leave chat
  const leaveChat = () => {
    if (socket) {
      socket.emit('terminate-chat');
    }
    setUser(null);
    setRoomInfo(null);
    setMessages([]);
    setIsVisible(false);
  };

  // Voice call
  const startVoiceCall = async () => {
    if (!socket || !user) {
      toast.error('Not connected to chat server');
      return;
    }
    try {
      console.log('Starting voice call...');
      const stream = await setupLocalMedia('voice');
      const pc = createPeerConnection();

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('initiate-voice-call');
      socket.emit('webrtc-offer', { offer, callType: 'voice' });
      toast.loading('Initiating voice call...');
    } catch (error) {
      console.error('Error starting voice call:', error);
      toast.error('Failed to access microphone');
    }
  };

  // Video call
  const startVideoCall = async () => {
    if (!socket || !user) {
      toast.error('Not connected to chat server');
      return;
    }
    try {
      console.log('Starting video call...');
      const stream = await setupLocalMedia('video');
      const pc = createPeerConnection();

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('initiate-video-call');
      socket.emit('webrtc-offer', { offer, callType: 'video' });
      toast.loading('Initiating video call...');
    } catch (error) {
      console.error('Error starting video call:', error);
      toast.error('Failed to access camera/microphone');
    }
  };

  // Accept call
  const acceptCall = async () => {
    if (!socket || !incomingCall) return;
    try {
      await setupLocalMedia(incomingCall.callType);
      socket.emit('accept-call');
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('Failed to access camera/microphone');
    }
  };

  // Reject call
  const rejectCall = () => {
    if (!socket || !incomingCall) return;
    socket.emit('reject-call');
    setIncomingCall(null);
  };

  // WebRTC Functions
  const setupLocalMedia = async (type: 'voice' | 'video') => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video'
      };

      console.log('Requesting media permissions:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setLocalStream(stream);
      setCallType(type);
      
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast.error('Failed to access camera/microphone. Please check permissions.');
      throw error;
    }
  };

  const createPeerConnection = () => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote stream');
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    setPeerConnection(pc);
    return pc;
  };

  const handleWebRTCOffer = async (offer: RTCSessionDescriptionInit, callType: 'voice' | 'video') => {
    try {
      const stream = await setupLocalMedia(callType);
      const pc = createPeerConnection();

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.emit('webrtc-answer', { answer });
      }

      setIsCallActive(true);
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
      toast.error('Failed to establish call connection');
    }
  };

  const handleWebRTCAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
        setIsCallActive(true);
      }
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
    }
  };

  const handleICECandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const endCall = () => {
    // Stop local media
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    setRemoteStream(null);
    setIsCallActive(false);
    setCallType(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Format timestamp
  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isVisible) {
    return (
      <motion.button
        className="fixed bottom-6 right-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 rounded-full shadow-2xl hover:shadow-amber-500/25 transition-all duration-300 z-50"
        onClick={() => setIsVisible(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <FontAwesomeIcon icon={faComment as IconProp} size="lg" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && setIsVisible(false)}
      >
        <motion.div
          className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[600px] flex flex-col overflow-hidden border border-gray-700"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-white text-xl" />
              <div>
                <h3 className="text-white font-bold text-lg">Anonymous Chat</h3>
                <div className="flex items-center space-x-2 text-amber-100 text-sm">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                  {user && (
                    <>
                      <span>•</span>
                      <span>Room: {user.roomId}</span>
                      <button
                        onClick={copyRoomId}
                        className="text-amber-100 hover:text-white transition-colors"
                        title="Copy room code"
                      >
                        <FontAwesomeIcon icon={faCopy as IconProp} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {user && roomInfo?.status === 'connected' && (
                <>
                  <button
                    onClick={startVoiceCall}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-lg transition-all duration-200"
                    title="Voice call"
                    disabled={isCallActive}
                  >
                    <FontAwesomeIcon icon={faPhone as IconProp} />
                  </button>
                  <button
                    onClick={startVideoCall}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-lg transition-all duration-200"
                    title="Video call"
                    disabled={isCallActive}
                  >
                    <FontAwesomeIcon icon={faVideo as IconProp} />
                  </button>
                </>
              )}
              
              {user && (
                <button
                  onClick={leaveChat}
                  className="bg-red-500 bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-lg transition-all duration-200"
                  title="Leave chat"
                >
                  <FontAwesomeIcon icon={faSignOutAlt as IconProp} />
                </button>
              )}

              <button
                onClick={() => setIsVisible(false)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-lg transition-all duration-200"
              >
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>
          </div>

          {/* Connection/Login Screen */}
          {!user && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                  <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-amber-400 text-6xl mb-4" />
                  <h4 className="text-2xl font-bold text-white mb-2">Join Anonymous Chat</h4>
                  <p className="text-gray-400">Start chatting securely without revealing your identity</p>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Enter your anonymous name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 outline-none"
                    maxLength={50}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={createRoom}
                      disabled={isConnecting || !isConnected}
                      className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-3 rounded-lg font-medium hover:from-amber-600 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnecting ? 'Creating...' : 'Create Room'}
                    </button>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Enter room code"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 outline-none"
                        maxLength={4}
                      />
                      <button
                        onClick={joinRoom}
                        disabled={isConnecting || !isConnected}
                        className="w-full bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConnecting ? 'Joining...' : 'Join Room'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <div className="flex items-center space-x-1">
                      <FontAwesomeIcon icon={faUserSecret as IconProp} />
                      <span>Anonymous</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FontAwesomeIcon icon={faEyeSlash as IconProp} />
                      <span>No tracking</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FontAwesomeIcon icon={faFileAlt as IconProp} />
                      <span>File sharing</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Waiting for guest */}
          {user && roomInfo?.status === 'waiting' && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <div className="animate-spin text-amber-400 text-4xl mb-4">
                  <FontAwesomeIcon icon={faUsers as IconProp} />
                </div>
                <h4 className="text-xl font-bold text-white">Waiting for someone to join...</h4>
                <p className="text-gray-400">Share your room code: <span className="text-amber-400 font-mono font-bold">{user.roomId}</span></p>
                <button
                  onClick={copyRoomId}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <FontAwesomeIcon icon={faCopy as IconProp} className="mr-2" />
                  Copy Room Code
                </button>
              </div>
            </div>
          )}

          {/* Chat Interface */}
          {user && roomInfo?.status === 'connected' && (
            <>
              {/* Chat Header with Users */}
              <div className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-white font-medium">
                        {roomInfo.hostName} & {roomInfo.guestName}
                      </span>
                    </div>
                    <div className="text-gray-400 text-sm">
                      Room: {user.roomId}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm">
                      You: {user.userName} ({user.role})
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div 
                className={`flex-1 p-4 overflow-y-auto bg-gray-800 messages-container relative ${
                  isDragOver ? 'bg-gray-700 border-2 border-dashed border-amber-500' : ''
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                    <div className="text-center text-amber-400">
                      <FontAwesomeIcon icon={faFileAlt as IconProp} className="text-4xl mb-2" />
                      <p className="text-lg font-medium">Drop file to share</p>
                    </div>
                  </div>
                )}
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 mt-8">
                    <FontAwesomeIcon icon={faComment as IconProp} className="text-4xl mb-4 opacity-50" />
                    <p className="text-lg font-medium">Start your anonymous conversation!</p>
                    <p className="text-sm mt-2">Share files, send messages, and communicate securely.</p>
                    <div className="mt-4 flex items-center justify-center space-x-6 text-xs">
                      <div className="flex items-center space-x-1">
                        <FontAwesomeIcon icon={faFileAlt as IconProp} className="text-amber-400" />
                        <span>File sharing</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-amber-400" />
                        <span>Anonymous</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FontAwesomeIcon icon={faEyeSlash as IconProp} className="text-amber-400" />
                        <span>No tracking</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.senderId === socket?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md ${
                        message.type === 'system' 
                          ? 'w-full text-center'
                          : message.senderId === socket?.id
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                            : 'bg-gray-700 text-white'
                      } rounded-lg p-3 shadow-lg`}>
                        
                        {message.type === 'system' ? (
                          <p className="text-amber-400 text-sm italic">{message.content}</p>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs opacity-75">{message.senderName}</span>
                              <span className="text-xs opacity-75">{formatTime(message.timestamp)}</span>
                            </div>
                            
                            {message.type === 'text' && (
                              <p className="text-sm break-words">{message.content}</p>
                            )}
                            
                            {message.type === 'emoji' && (
                              <p className="text-2xl">{message.content}</p>
                            )}
                            
                            {message.type === 'file' && (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2 text-sm">
                                  <FontAwesomeIcon icon={faFileAlt as IconProp} />
                                  <span className="truncate">{message.fileName}</span>
                                </div>
                                {message.fileSize && (
                                  <p className="text-xs opacity-75">{formatFileSize(message.fileSize)}</p>
                                )}
                                <button
                                  onClick={() => downloadFile(message)}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1 rounded text-xs transition-colors"
                                >
                                  <FontAwesomeIcon icon={faDownload as IconProp} className="mr-1" />
                                  Download
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  
                  {otherUserTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-gray-700 rounded-lg p-3 text-gray-400 text-sm">
                        <span>{roomInfo.guestName || roomInfo.hostName} is typing...</span>
                      </div>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-700 bg-gray-900">
                {/* File Preview */}
                {selectedFile && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 border-b border-gray-700"
                  >
                    <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon 
                            icon={getFileIcon(selectedFile.name, selectedFile.type) as IconProp} 
                            className="text-white" 
                          />
                        </div>
                        <div>
                          <p className="text-white font-medium truncate max-w-48">{selectedFile.name}</p>
                          <p className="text-gray-400 text-sm">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={sendFile}
                          disabled={!roomInfo?.hostName || !roomInfo?.guestName}
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          Send
                        </button>
                        <button
                          onClick={cancelFileSelection}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="p-4">
                  <div className="flex items-end space-x-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!roomInfo?.hostName || !roomInfo?.guestName}
                    className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white p-3 rounded-lg transition-colors"
                    title={roomInfo?.hostName && roomInfo?.guestName ? "Attach file" : "Wait for both users to join"}
                  >
                    <FontAwesomeIcon icon={faPlus as IconProp} />
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={handleTyping}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder={
                        roomInfo?.hostName && roomInfo?.guestName
                          ? `Message ${user?.role === 'host' ? roomInfo.guestName : roomInfo.hostName}...`
                          : 'Waiting for someone to join...'
                      }
                      className="w-full p-3 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 outline-none"
                      maxLength={1000}
                      disabled={!roomInfo?.hostName || !roomInfo?.guestName}
                    />
                    <div className="absolute right-3 top-3 text-xs text-gray-400">
                      {currentMessage.length}/1000
                    </div>
                  </div>

                  <button
                    onClick={sendMessage}
                    disabled={!currentMessage.trim()}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white p-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FontAwesomeIcon icon={faPaperPlane as IconProp} />
                  </button>
                </div>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Incoming Call Modal */}
        {incomingCall && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-gray-800 rounded-2xl p-6 text-center space-y-4 max-w-sm w-full mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <FontAwesomeIcon 
                icon={incomingCall.callType === 'video' ? faVideo as IconProp : faPhone as IconProp} 
                className="text-amber-400 text-4xl" 
              />
              <h3 className="text-white text-xl font-bold">Incoming {incomingCall.callType} call</h3>
              <p className="text-gray-400">from {incomingCall.callerName}</p>
              
              <div className="flex space-x-4">
                <button
                  onClick={rejectCall}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white p-3 rounded-lg transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={acceptCall}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg transition-colors"
                >
                  Accept
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Video Call Overlay */}
        {isCallActive && (
          <motion.div
            className="fixed inset-0 bg-black z-70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="relative w-full h-full">
              {/* Remote Video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Local Video (Picture-in-Picture) */}
              {callType === 'video' && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg object-cover border-2 border-gray-600"
                />
              )}

              {/* Call Controls */}
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4">
                <button
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition-colors ${
                    isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <FontAwesomeIcon 
                    icon={isMuted ? faTimes as IconProp : faPhone as IconProp} 
                    className="text-white text-xl"
                  />
                </button>

                {callType === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`p-4 rounded-full transition-colors ${
                      isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <FontAwesomeIcon 
                      icon={isVideoOff ? faTimes as IconProp : faVideo as IconProp} 
                      className="text-white text-xl"
                    />
                  </button>
                )}

                <button
                  onClick={() => {
                    endCall();
                    if (socket) socket.emit('reject-call');
                  }}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                >
                  <FontAwesomeIcon icon={faTimes as IconProp} className="text-white text-xl" />
                </button>
              </div>

              {/* Call Info */}
              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center">
                <div className="bg-black bg-opacity-50 rounded-lg p-4">
                  <p className="text-white text-lg font-medium">
                    {callType === 'video' ? 'Video Call' : 'Voice Call'}
                  </p>
                  <p className="text-gray-300 text-sm">
                    {roomInfo?.hostName && roomInfo?.guestName ? 
                      `${user?.role === 'host' ? roomInfo.guestName : roomInfo.hostName}` : 
                      'Connecting...'
                    }
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnonymousChat;
