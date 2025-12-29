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
  faFileExcel,
  faMicrophone,
  faMicrophoneSlash,
  faVideoSlash,
  faPhoneSlash,
  faExpand,
  faCompress,
  faVolumeUp,
  faVolumeMute,
  faPhoneAlt,
  faSyncAlt
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
  const [callDuration, setCallDuration] = useState(0);
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended'>('idle');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs - declare before useEffects that use them
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callContainerRef = useRef<HTMLDivElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Set remote video/audio when remoteStream changes
  React.useEffect(() => {
    if (remoteStream) {
      console.log('📺 Setting remote stream:', remoteStream.getTracks());
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        // Ensure video plays
        remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e));
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(e => console.log('Remote audio play error:', e));
      }
    }
  }, [remoteStream]);

  // Set local video when localStream changes
  React.useEffect(() => {
    if (localStream && localVideoRef.current && callType === 'video') {
      console.log('📹 Setting local video from useEffect:', localStream.getTracks());
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
    }
  }, [localStream, callType]);

  // Call timer effect
  useEffect(() => {
    if (isCallConnected) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isCallConnected]);

  // Format call duration
  const formatCallDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && callContainerRef.current) {
      callContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
      forceNew: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to chat server (ID: ' + socketInstance.id + ')');
      setIsConnected(true);
      toast.success('Connected to chat server');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server. Reason:', reason);
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
      console.log('🏠 Room created event received:', data);
      setUser({ roomId: data.roomId, userName: data.userName, role: 'host' });
      setRoomInfo({ roomId: data.roomId, hostName: data.userName, guestName: null, status: 'waiting' });
      toast.success(`Room ${data.roomId} created! Share this code with someone to start chatting.`);
      setIsConnecting(false);
    });

    socketInstance.on('room-joined', (data) => {
      console.log('🚪 Room joined event received:', data);
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
      console.log('👤 User joined event received:', data);
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
      console.log('📞 Incoming voice call from:', data.callerName);
      setIncomingCall({ ...data, callType: 'voice' });
    });

    socketInstance.on('incoming-video-call', (data) => {
      console.log('📹 Incoming video call from:', data.callerName);
      setIncomingCall({ ...data, callType: 'video' });
    });

    socketInstance.on('call-initiated', (data) => {
      console.log('Call initiated:', data);
      setCallStatus('ringing');
      toast.success(`Calling... Waiting for response`);
    });

    socketInstance.on('call-ended', (data) => {
      console.log('Call ended event received:', data);
      setIsCallActive(false);
      setCallType(null);
      setIncomingCall(null);
      setIsCallConnected(false);
      setCallStatus('ended');
      setIsInitiatingCall(false);
      endCall();
      toast(`Call ended: ${data.reason || 'Call terminated'}`);
      // Reset status after a moment
      setTimeout(() => setCallStatus('idle'), 2000);
    });

    socketInstance.on('call-rejected', (data) => {
      console.log('Call rejected event received:', data);
      setIsCallActive(false);
      setCallType(null);
      setIncomingCall(null);
      setIsCallConnected(false);
      setCallStatus('ended');
      setIsInitiatingCall(false);
      endCall();
      toast.error('Call was declined');
      setTimeout(() => setCallStatus('idle'), 2000);
    });

    // When call is accepted by receiver
    socketInstance.on('call-accepted', () => {
      console.log('📞 Call accepted by receiver');
      setCallStatus('connecting');
      setIncomingCall(null);
      toast.success('Call accepted! Connecting...');
    });

    // CALLER receives this after receiver accepts - now send the WebRTC offer
    socketInstance.on('send-webrtc-offer', async (data) => {
      console.log('📡 Received signal to send WebRTC offer');
      try {
        const { callType: acceptedCallType } = data;
        
        // Ensure call state is set
        setIsCallActive(true);
        setCallStatus('connecting');
        
        // Enumerate video devices for camera switching
        if (acceptedCallType === 'video') {
          await enumerateVideoDevices();
          setCurrentFacingMode('user');
        }
        
        // Get local media first with fallback constraints
        let stream: MediaStream;
        try {
          const constraints: MediaStreamConstraints = {
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true, 
              autoGainControl: true,
              sampleRate: 48000
            },
            video: acceptedCallType === 'video' ? { 
              width: { ideal: 1280, min: 320 }, 
              height: { ideal: 720, min: 240 }, 
              facingMode: 'user',
              frameRate: { ideal: 30, min: 15 },
              aspectRatio: { ideal: 16/9 }
            } : false
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaError) {
          console.warn('Failed with ideal constraints, trying basic:', mediaError);
          // Fallback to basic constraints
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: acceptedCallType === 'video'
          });
        }
        
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCallType(acceptedCallType);
        
        // Set local video immediately for video calls
        if (acceptedCallType === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.log('Local video play:', e));
        }
        
        // Create peer connection with better ICE servers
        const configuration: RTCConfiguration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.stunprotocol.org:3478' },
            // Free TURN servers for better NAT traversal
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ],
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        };
        
        const pc = new RTCPeerConnection(configuration);
        peerConnectionRef.current = pc;
        setPeerConnection(pc);

        // ICE candidate handler with batching
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('🧊 Sending ICE candidate (caller):', event.candidate.type);
            socketInstance.emit('webrtc-ice-candidate', { candidate: event.candidate });
          }
        };

        // Track handler for receiving remote media
        pc.ontrack = (event) => {
          console.log('📺 Received remote track (caller):', event.track.kind);
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            // Set video element directly
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
              remoteVideoRef.current.play().catch(e => console.log('Remote video play:', e));
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = event.streams[0];
              remoteAudioRef.current.play().catch(e => console.log('Remote audio play:', e));
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('ICE state (caller):', pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            console.log('✅ ICE Connected (caller)');
            setIsCallConnected(true);
            setCallStatus('connected');
            setIsInitiatingCall(false);
          } else if (pc.iceConnectionState === 'failed') {
            console.log('❌ ICE Failed - attempting restart');
            pc.restartIce();
            toast.error('Connection failed, retrying...');
          } else if (pc.iceConnectionState === 'disconnected') {
            toast.error('Connection lost');
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('Connection state (caller):', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setIsCallConnected(true);
            setCallStatus('connected');
          }
        };

        // Add local tracks BEFORE creating offer
        stream.getTracks().forEach(track => {
          console.log('Adding track:', track.kind);
          pc.addTrack(track, stream);
        });

        // Create and send offer with proper options
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: acceptedCallType === 'video'
        });
        await pc.setLocalDescription(offer);

        socketInstance.emit('webrtc-offer', { offer: pc.localDescription, callType: acceptedCallType });
        console.log('✅ Sent WebRTC offer');
        
      } catch (error) {
        console.error('❌ Error creating WebRTC offer:', error);
        toast.error('Failed to start call. Check microphone/camera permissions.');
        cleanupCall();
      }
    });

    // WebRTC signaling handlers - receiver gets offer AFTER accepting
    socketInstance.on('webrtc-offer', async (data) => {
      console.log('📡 Received WebRTC offer from caller');
      try {
        const { offer, callType: incomingCallType } = data;
        
        // Create peer connection with better ICE servers
        const configuration: RTCConfiguration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.stunprotocol.org:3478' },
            // Free TURN servers for better NAT traversal
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ],
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        };
        
        const pc = new RTCPeerConnection(configuration);
        peerConnectionRef.current = pc;
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('🧊 Sending ICE candidate (receiver):', event.candidate.type);
            socketInstance.emit('webrtc-ice-candidate', { candidate: event.candidate });
          }
        };

        pc.ontrack = (event) => {
          console.log('📺 Received remote track (receiver):', event.track.kind);
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            // Set video/audio elements directly
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
              remoteVideoRef.current.play().catch(e => console.log('Remote video play:', e));
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = event.streams[0];
              remoteAudioRef.current.play().catch(e => console.log('Remote audio play:', e));
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('ICE state (receiver):', pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            console.log('✅ ICE Connected (receiver)');
            setIsCallConnected(true);
            setCallStatus('connected');
            setIsInitiatingCall(false);
          } else if (pc.iceConnectionState === 'failed') {
            console.log('❌ ICE Failed - attempting restart');
            pc.restartIce();
            toast.error('Connection failed, retrying...');
          } else if (pc.iceConnectionState === 'disconnected') {
            toast.error('Connection lost');
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('Connection state (receiver):', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setIsCallConnected(true);
            setCallStatus('connected');
          }
        };
        
        // Get local media with fallback
        let stream: MediaStream;
        try {
          const constraints: MediaStreamConstraints = {
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000
            },
            video: incomingCallType === 'video' ? { 
              width: { ideal: 1280, min: 320 }, 
              height: { ideal: 720, min: 240 },
              frameRate: { ideal: 30, min: 15 },
              aspectRatio: { ideal: 16/9 }
            } : false
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaError) {
          console.warn('Failed with ideal constraints, trying basic:', mediaError);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: incomingCallType === 'video'
          });
        }
        
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCallType(incomingCallType);
        
        // Set local video immediately for video calls
        if (incomingCallType === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.log('Local video play:', e));
        }
        
        // Add local tracks BEFORE setting remote description
        stream.getTracks().forEach(track => {
          console.log('Adding track:', track.kind);
          pc.addTrack(track, stream);
        });
        
        // Set remote description (the offer)
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Process any pending ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Failed to add pending ICE candidate:', e);
          }
        }
        pendingCandidatesRef.current = [];
        
        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socketInstance.emit('webrtc-answer', { answer: pc.localDescription });
        
        // Ensure call state is set
        setIsCallActive(true);
        setIncomingCall(null);
        setCallStatus('connecting');
        setPeerConnection(pc);
        
        console.log('✅ Sent WebRTC answer, isCallActive set to true');
      } catch (error) {
        console.error('❌ Error handling WebRTC offer:', error);
        toast.error('Failed to connect call. Check microphone/camera permissions.');
      }
    });

    socketInstance.on('webrtc-answer', async (data) => {
      console.log('📡 Received WebRTC answer from receiver');
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('✅ Set remote description from answer');
          
          // Process any pending ICE candidates
          for (const candidate of pendingCandidatesRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('Failed to add pending ICE candidate:', e);
            }
          }
          pendingCandidatesRef.current = [];
        } else {
          console.warn('Cannot set answer, signaling state:', pc?.signalingState);
        }
      } catch (error) {
        console.error('❌ Error handling WebRTC answer:', error);
      }
    });

    socketInstance.on('webrtc-ice-candidate', async (data) => {
      console.log('🧊 Received ICE candidate');
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          // Store candidate for later
          pendingCandidatesRef.current.push(data.candidate);
        }
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    });

    // When the caller should send the offer (after receiver accepts)
    // Note: This is now handled by 'send-webrtc-offer' event

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
    console.log('=== START VOICE CALL ===');
    
    if (!socket || !socket.connected || !user || !isConnected) {
      toast.error('Not connected to chat server');
      return;
    }
    
    if (isInitiatingCall || isCallActive) {
      toast.error('A call is already in progress');
      return;
    }
    
    try {
      setIsInitiatingCall(true);
      setCallStatus('initiating');
      setCallType('voice');
      
      // Just emit the call initiation - WebRTC setup happens after receiver accepts
      socket.emit('initiate-voice-call', {});
      
      setIsCallActive(true);
      setCallStatus('ringing');
      toast.success('Calling...');
      console.log('✅ Voice call initiated, waiting for acceptance');
      
    } catch (error) {
      console.error('❌ Voice call failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Voice call failed: ${errorMessage}`);
      cleanupCall();
    }
  };

  // Video call
  const startVideoCall = async () => {
    console.log('=== START VIDEO CALL ===');
    
    if (!socket || !socket.connected || !user || !isConnected) {
      toast.error('Not connected to chat server');
      return;
    }
    
    if (isInitiatingCall || isCallActive) {
      toast.error('A call is already in progress');
      return;
    }
    
    try {
      setIsInitiatingCall(true);
      setCallStatus('initiating');
      setCallType('video');
      
      // Just emit the call initiation - WebRTC setup happens after receiver accepts
      socket.emit('initiate-video-call', {});
      
      setIsCallActive(true);
      setCallStatus('ringing');
      toast.success('Calling...');
      console.log('✅ Video call initiated, waiting for acceptance');
      
    } catch (error) {
      console.error('❌ Video call failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Video call failed: ${errorMessage}`);
      cleanupCall();
    }
  };

  // Accept call - when user clicks accept, the WebRTC offer handler will set everything up
  const acceptCall = async () => {
    if (!socket || !incomingCall) return;
    console.log('📞 Accepting call:', incomingCall.callType);
    setCallStatus('connecting');
    setCallType(incomingCall.callType);
    setIsCallActive(true); // Show call UI immediately
    setIsInitiatingCall(false);
    
    // Enumerate video devices for camera switching
    if (incomingCall.callType === 'video') {
      await enumerateVideoDevices();
      setCurrentFacingMode('user');
    }
    
    socket.emit('accept-call');
    toast.success('Connecting...');
    // Note: The actual WebRTC setup happens in the webrtc-offer handler
  };

  // Reject call
  const rejectCall = () => {
    if (!socket || !incomingCall) return;
    socket.emit('reject-call');
    setIncomingCall(null);
    setCallStatus('idle');
    toast('Call declined');
  };

  const endCall = () => {
    console.log('=== ENDING CALL ===');
    
    // Stop local media streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    // Clear pending candidates
    pendingCandidatesRef.current = [];

    // Reset all call-related state
    setRemoteStream(null);
    setIsCallActive(false);
    setCallType(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIncomingCall(null);
    setIsCallConnected(false);
    setCallStatus('idle');
    setIsInitiatingCall(false);
    setCallDuration(0);
    
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const cleanupCall = () => {
    endCall();
  };

  const handleEndCall = () => {
    endCall();
    if (socket) {
      socket.emit('end-call');
    }
  };

  const toggleMute = () => {
    const stream = localStreamRef.current || localStream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        toast(audioTrack.enabled ? 'Microphone unmuted' : 'Microphone muted', { icon: audioTrack.enabled ? '🎤' : '🔇' });
      }
    }
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current || localStream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        toast(videoTrack.enabled ? 'Camera on' : 'Camera off', { icon: videoTrack.enabled ? '📹' : '📷' });
      }
    }
  };

  const toggleSpeaker = () => {
    // Toggle both video and audio elements for speaker
    const newMutedState = isSpeakerOn;
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = newMutedState;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = newMutedState;
    }
    
    setIsSpeakerOn(!newMutedState);
    toast(newMutedState ? 'Speaker off' : 'Speaker on', { icon: newMutedState ? '🔇' : '🔊' });
  };

  // Enumerate available video devices
  const enumerateVideoDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      console.log('📷 Available video devices:', videoInputs);
      setVideoDevices(videoInputs);
      return videoInputs;
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      return [];
    }
  };

  // Switch camera (front/back)
  const switchCamera = async () => {
    if (isSwitchingCamera || !isCallActive || callType !== 'video') return;
    
    setIsSwitchingCamera(true);
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    try {
      // Get new stream with different camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 1280, min: 320 },
          height: { ideal: 720, min: 240 },
          frameRate: { ideal: 30, min: 15 }
        }
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const currentStream = localStreamRef.current;
      
      if (currentStream && peerConnectionRef.current) {
        // Get the current video track
        const currentVideoTrack = currentStream.getVideoTracks()[0];
        
        // Find the sender for the video track and replace it
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(sender => sender.track?.kind === 'video');
        
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
        
        // Stop the old video track
        if (currentVideoTrack) {
          currentVideoTrack.stop();
        }
        
        // Update the local stream - remove old video track and add new one
        currentStream.removeTrack(currentVideoTrack);
        currentStream.addTrack(newVideoTrack);
        
        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = currentStream;
        }
        
        setCurrentFacingMode(newFacingMode);
        toast.success(newFacingMode === 'user' ? 'Switched to front camera' : 'Switched to back camera');
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
      // If exact facingMode fails, try without exact constraint
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: newFacingMode,
            width: { ideal: 1280, min: 320 },
            height: { ideal: 720, min: 240 }
          }
        });
        
        const newVideoTrack = fallbackStream.getVideoTracks()[0];
        const currentStream = localStreamRef.current;
        
        if (currentStream && peerConnectionRef.current) {
          const currentVideoTrack = currentStream.getVideoTracks()[0];
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(sender => sender.track?.kind === 'video');
          
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          }
          
          if (currentVideoTrack) {
            currentVideoTrack.stop();
          }
          
          currentStream.removeTrack(currentVideoTrack);
          currentStream.addTrack(newVideoTrack);
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = currentStream;
          }
          
          setCurrentFacingMode(newFacingMode);
          toast.success(newFacingMode === 'user' ? 'Switched to front camera' : 'Switched to back camera');
        }
      } catch (fallbackError) {
        console.error('Camera switch failed completely:', fallbackError);
        toast.error('Unable to switch camera');
      }
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  // Get other user's name for display
  const getOtherUserName = () => {
    if (!roomInfo || !user) return 'Other user';
    return user.role === 'host' ? roomInfo.guestName : roomInfo.hostName;
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
                    className={`text-white p-2 rounded-lg transition-all duration-200 ${
                      isCallActive || isInitiatingCall 
                        ? 'bg-gray-500 cursor-not-allowed opacity-50' 
                        : 'bg-white bg-opacity-20 hover:bg-opacity-30 hover:scale-105'
                    }`}
                    title="Voice call"
                    disabled={isCallActive || isInitiatingCall}
                  >
                    <FontAwesomeIcon icon={faPhone as IconProp} />
                  </button>
                  <button
                    onClick={startVideoCall}
                    className={`text-white p-2 rounded-lg transition-all duration-200 ${
                      isCallActive || isInitiatingCall 
                        ? 'bg-gray-500 cursor-not-allowed opacity-50' 
                        : 'bg-white bg-opacity-20 hover:bg-opacity-30 hover:scale-105'
                    }`}
                    title="Video call"
                    disabled={isCallActive || isInitiatingCall}
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
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 text-center space-y-6 max-w-sm w-full mx-4 border border-gray-700 shadow-2xl"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Animated caller avatar */}
              <div className="relative">
                <motion.div
                  className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <FontAwesomeIcon 
                    icon={faUserSecret as IconProp} 
                    className="text-white text-4xl" 
                  />
                </motion.div>
                {/* Ripple effect */}
                <motion.div
                  className="absolute inset-0 mx-auto w-24 h-24 rounded-full border-2 border-amber-500"
                  animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 mx-auto w-24 h-24 rounded-full border-2 border-amber-500"
                  animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                />
              </div>

              {/* Call type icon */}
              <div className="flex items-center justify-center space-x-2 text-amber-400">
                <FontAwesomeIcon 
                  icon={incomingCall.callType === 'video' ? faVideo as IconProp : faPhoneAlt as IconProp} 
                  className="text-2xl" 
                />
                <span className="text-lg font-medium">
                  Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
                </span>
              </div>

              <div>
                <h3 className="text-white text-2xl font-bold">{incomingCall.callerName}</h3>
                <p className="text-gray-400 text-sm mt-1">is calling you...</p>
              </div>
              
              <div className="flex justify-center space-x-6 pt-4">
                <motion.button
                  onClick={rejectCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-all"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FontAwesomeIcon icon={faPhoneSlash as IconProp} className="text-2xl" />
                </motion.button>
                <motion.button
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-500/30 transition-all"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <FontAwesomeIcon icon={faPhone as IconProp} className="text-2xl" />
                </motion.button>
              </div>

              <p className="text-gray-500 text-xs">
                {incomingCall.callType === 'video' ? 'Camera and microphone will be used' : 'Microphone will be used'}
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* Video/Voice Call Overlay */}
        {isCallActive && (
          <motion.div
            ref={callContainerRef}
            className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black z-[100]"
            style={{ width: '100vw', height: '100vh', minHeight: '-webkit-fill-available' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="relative w-full h-full flex flex-col" style={{ height: '100%' }}>
              {/* Call Header */}
              <motion.div 
                className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/70 to-transparent"
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${isCallConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`}></div>
                    <span className="text-white font-medium">
                      {callType === 'video' ? 'Video Call' : 'Voice Call'}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {isCallConnected && (
                      <div className="bg-black/50 rounded-full px-4 py-2 flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-white font-mono text-sm">{formatCallDuration(callDuration)}</span>
                      </div>
                    )}
                    
                    <button
                      onClick={toggleFullscreen}
                      className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all"
                      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                      <FontAwesomeIcon icon={isFullscreen ? faCompress as IconProp : faExpand as IconProp} />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Main Video/Audio Area */}
              <div className="absolute inset-0 flex items-center justify-center" style={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                {callType === 'video' ? (
                  <>
                    {/* Remote Video - Full Screen */}
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full"
                      style={{ 
                        backgroundColor: '#1a1a1a',
                        objectFit: 'contain',
                        maxWidth: '100%',
                        maxHeight: '100%'
                      }}
                    />
                    
                    {/* Local Video (Picture-in-Picture) */}
                    {localStream && (
                      <motion.div
                        className="absolute z-30 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gray-900"
                        style={{
                          top: '80px',
                          right: '16px',
                          width: 'min(30vw, 150px)',
                          height: 'min(22.5vw, 112px)',
                          minWidth: '100px',
                          minHeight: '75px'
                        }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        drag
                        dragConstraints={{ top: 20, left: -200, right: 0, bottom: -100 }}
                      >
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-contain ${isVideoOff ? 'hidden' : ''}`}
                          style={{ backgroundColor: '#1a1a1a' }}
                        />
                        {isVideoOff && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <FontAwesomeIcon icon={faVideoSlash as IconProp} className="text-white/50 text-2xl" />
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-black/60 rounded px-2 py-1 flex items-center space-x-1">
                          <span className="text-white text-xs">You</span>
                          {videoDevices.length > 1 && (
                            <span className="text-gray-400 text-xs">
                              ({currentFacingMode === 'user' ? 'Front' : 'Back'})
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </>
                ) : (
                  /* Voice Call UI */
                  <div className="flex flex-col items-center justify-center space-y-8">
                    {/* Voice wave animation */}
                    <div className="relative">
                      <motion.div
                        className="w-32 h-32 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center"
                        animate={isCallConnected ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-white text-5xl" />
                      </motion.div>
                      
                      {/* Audio visualizer rings */}
                      {isCallConnected && (
                        <>
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-amber-500/50"
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-amber-500/50"
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
                          />
                        </>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <h2 className="text-white text-2xl font-bold">{getOtherUserName()}</h2>
                      <p className="text-gray-400 mt-1">
                        {callStatus === 'ringing' && 'Calling...'}
                        {callStatus === 'connecting' && 'Connecting...'}
                        {callStatus === 'connected' && formatCallDuration(callDuration)}
                        {callStatus === 'initiating' && 'Starting call...'}
                      </p>
                    </div>

                    {/* Voice activity indicator */}
                    {isCallConnected && (
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-1 bg-amber-500 rounded-full"
                            animate={{ height: ['8px', '24px', '8px'] }}
                            transition={{ 
                              duration: 0.8, 
                              repeat: Infinity, 
                              delay: i * 0.1,
                              ease: 'easeInOut'
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Connecting Overlay */}
                {!isCallConnected && (
                  <motion.div 
                    className="absolute inset-0 flex items-center justify-center bg-black/60"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="text-center space-y-4">
                      <motion.div
                        className="w-20 h-20 mx-auto rounded-full border-4 border-amber-500 border-t-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <p className="text-white text-lg font-medium">
                        {callStatus === 'ringing' && `Calling ${getOtherUserName()}...`}
                        {callStatus === 'connecting' && 'Connecting...'}
                        {callStatus === 'initiating' && 'Starting call...'}
                      </p>
                      <p className="text-gray-400 text-sm">Please wait</p>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Hidden audio element for remote audio playback */}
              <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                style={{ display: 'none' }}
              />

              {/* Call Controls */}
              <motion.div 
                className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/80 to-transparent"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-center space-x-4 max-w-md mx-auto">
                  {/* Mute Button */}
                  <motion.button
                    onClick={toggleMute}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      isMuted 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                        : 'bg-gray-700 hover:bg-gray-600 shadow-black/30'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    <FontAwesomeIcon 
                      icon={isMuted ? faMicrophoneSlash as IconProp : faMicrophone as IconProp} 
                      className="text-white text-xl"
                    />
                  </motion.button>

                  {/* Video Toggle (only for video calls) */}
                  {callType === 'video' && (
                    <motion.button
                      onClick={toggleVideo}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isVideoOff 
                          ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                          : 'bg-gray-700 hover:bg-gray-600 shadow-black/30'
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                    >
                      <FontAwesomeIcon 
                        icon={isVideoOff ? faVideoSlash as IconProp : faVideo as IconProp} 
                        className="text-white text-xl"
                      />
                    </motion.button>
                  )}

                  {/* Camera Switch Button (only for video calls with multiple cameras) */}
                  {callType === 'video' && videoDevices.length > 1 && (
                    <motion.button
                      onClick={switchCamera}
                      disabled={isSwitchingCamera}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isSwitchingCamera 
                          ? 'bg-gray-600 cursor-not-allowed' 
                          : 'bg-gray-700 hover:bg-gray-600 shadow-black/30'
                      }`}
                      whileHover={!isSwitchingCamera ? { scale: 1.1 } : {}}
                      whileTap={!isSwitchingCamera ? { scale: 0.95 } : {}}
                      title={currentFacingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
                    >
                      <FontAwesomeIcon 
                        icon={faSyncAlt as IconProp} 
                        className={`text-white text-xl ${isSwitchingCamera ? 'animate-spin' : ''}`}
                      />
                    </motion.button>
                  )}

                  {/* Speaker Toggle */}
                  <motion.button
                    onClick={toggleSpeaker}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      !isSpeakerOn 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                        : 'bg-gray-700 hover:bg-gray-600 shadow-black/30'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    title={isSpeakerOn ? 'Mute speaker' : 'Unmute speaker'}
                  >
                    <FontAwesomeIcon 
                      icon={isSpeakerOn ? faVolumeUp as IconProp : faVolumeMute as IconProp} 
                      className="text-white text-xl"
                    />
                  </motion.button>

                  {/* End Call Button */}
                  <motion.button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    title="End call"
                  >
                    <FontAwesomeIcon icon={faPhoneSlash as IconProp} className="text-white text-2xl" />
                  </motion.button>
                </div>

                {/* Call info footer */}
                <div className="text-center mt-4">
                  <p className="text-gray-500 text-xs">
                    {isCallConnected ? 'Secure peer-to-peer connection' : 'Establishing connection...'}
                  </p>
                </div>
              </motion.div>

              {/* Remote User Name Tag (for video calls) */}
              {callType === 'video' && isCallConnected && (
                <motion.div
                  className="absolute bottom-28 left-4 bg-black/60 rounded-lg px-3 py-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-white text-sm font-medium">{getOtherUserName()}</span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnonymousChat;
