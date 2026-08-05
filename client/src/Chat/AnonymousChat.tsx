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
  faSyncAlt,
  faDesktop,
  faUsersRectangle
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import './AnonymousChat.css';
import GroupMeeting from './GroupMeeting';
import { sounds } from '../utils/soundEffects';

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
  const [showGroupMeeting, setShowGroupMeeting] = useState(false);

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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isScreenShareSupported, setIsScreenShareSupported] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
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

  // Prevent background scrolling when chat is open
  React.useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

  // Set remote video/audio when remoteStream changes - SIMPLIFIED
  React.useEffect(() => {
    if (!remoteStream) return;
    
    console.log('📺 Setting remote stream:', remoteStream.getTracks().map(t => t.kind));
    const audioTracks = remoteStream.getAudioTracks();
    console.log('📺 Audio tracks:', audioTracks.map(t => ({ enabled: t.enabled, readyState: t.readyState })));
    
    // Ensure audio tracks are enabled
    audioTracks.forEach(track => {
      track.enabled = true;
    });
    
    // Use a small delay to avoid race conditions with multiple srcObject assignments
    const setupMedia = () => {
      // Set video element (handles both video and audio)
      if (remoteVideoRef.current) {
        const video = remoteVideoRef.current;
        if (video.srcObject !== remoteStream) {
          video.srcObject = remoteStream;
        }
        video.muted = false;
        video.volume = 1.0;
        
        const playPromise = video.play();
        if (playPromise) {
          playPromise
            .then(() => console.log('✅ Remote video+audio playing'))
            .catch(e => {
              if (e.name === 'NotAllowedError') {
                console.log('⚠️ Autoplay blocked, waiting for user interaction');
                const playOnClick = () => {
                  video.play().catch(() => {});
                  document.removeEventListener('click', playOnClick);
                };
                document.addEventListener('click', playOnClick, { once: true });
                toast('Tap anywhere to enable audio', { icon: '🔊', duration: 3000 });
              }
              // Ignore AbortError - it's just race condition
            });
        }
      }
      
      // Set hidden audio element as backup (don't call play - let autoplay handle it)
      if (remoteAudioRef.current) {
        const audio = remoteAudioRef.current;
        if (audio.srcObject !== remoteStream) {
          audio.srcObject = remoteStream;
        }
        audio.volume = 1.0;
        audio.muted = false;
        // Let autoPlay attribute handle this, don't call play()
      }
    };
    
    // Small delay to let other assignments complete first
    setTimeout(setupMedia, 100);
    
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

  // Check if screen sharing is supported (not available on mobile browsers)
  useEffect(() => {
    const checkScreenShareSupport = () => {
      // Check if getDisplayMedia is available
      const hasGetDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
      
      // Additional check: detect mobile devices where screen sharing typically doesn't work
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Screen sharing is supported if getDisplayMedia exists AND it's not a mobile device
      setIsScreenShareSupported(hasGetDisplayMedia && !isMobile);
    };
    
    checkScreenShareSupport();
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
      sounds.playChime();
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
      sounds.playChime();
      setIsConnecting(false);
    });

    socketInstance.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, { ...message, timestamp: new Date(message.timestamp) }]);
      
      // Show notification for file messages
      if (message.type === 'file') {
        toast.success(`${message.senderName} shared a file: ${message.fileName}`);
      }
      
      // Play pop sound for incoming messages
      if (message.senderId !== socketInstance.id) {
        sounds.playPop();
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
              autoGainControl: true
              // Note: Removed sampleRate to improve cross-platform compatibility
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
            // Just set the stream - useEffect will handle playback
            setRemoteStream(event.streams[0]);
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

        // Add local tracks - addTrack creates transceivers automatically
        stream.getTracks().forEach(track => {
          console.log('Adding track:', track.kind, 'enabled:', track.enabled);
          pc.addTrack(track, stream);
        });

        // Create and send offer with proper options
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: acceptedCallType === 'video'
        });
        
        // Log SDP to verify audio is included
        console.log('📝 Offer SDP contains audio:', offer.sdp?.includes('m=audio'));
        
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
            // Just set the stream - useEffect will handle playback
            setRemoteStream(event.streams[0]);
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
              autoGainControl: true
              // Note: Removed sampleRate to improve cross-platform compatibility
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
        // addTrack creates transceivers automatically
        stream.getTracks().forEach(track => {
          console.log('Adding track:', track.kind, 'enabled:', track.enabled);
          pc.addTrack(track, stream);
        });
        
        // Set remote description (the offer)
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Log to verify audio is in the offer
        console.log('📝 Received offer contains audio:', offer.sdp?.includes('m=audio'));
        
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

    sounds.playWhoosh();
    
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
    
    // Stop screen sharing stream if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    
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

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    // Check if screen sharing is supported
    if (!isScreenShareSupported) {
      toast.error('Screen sharing is not supported on mobile devices');
      return;
    }
    
    if (!peerConnectionRef.current || !localStreamRef.current) {
      toast.error('Call not connected');
      return;
    }

    try {
      if (isScreenSharing) {
        // Stop screen sharing and switch back to camera
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        // Get camera stream again
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 320 },
            height: { ideal: 720, min: 240 },
            facingMode: currentFacingMode,
            frameRate: { ideal: 30, min: 15 }
          }
        });

        const newVideoTrack = cameraStream.getVideoTracks()[0];
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(sender => sender.track?.kind === 'video');

        if (videoSender && newVideoTrack) {
          await videoSender.replaceTrack(newVideoTrack);
        }

        // Update local stream
        const currentStream = localStreamRef.current;
        const oldVideoTrack = currentStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          currentStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        currentStream.addTrack(newVideoTrack);

        // Update local video display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = currentStream;
        }

        setIsScreenSharing(false);
        toast.success('Switched back to camera');
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          } as MediaTrackConstraints,
          audio: false
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          if (isScreenSharing) {
            toggleScreenShare();
          }
        };

        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(sender => sender.track?.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        // Update local video display to show screen share
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
      if ((error as Error).name === 'NotAllowedError') {
        toast.error('Screen sharing permission denied');
      } else {
        toast.error('Failed to toggle screen sharing');
      }
      setIsScreenSharing(false);
    }
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
        className="fixed bottom-6 right-6 bg-orange-500 text-white p-4 rounded-full shadow-2xl hover:shadow-orange-500/25 transition-all duration-300 z-50"
        onClick={() => setIsVisible(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        aria-label="Open anonymous chat"
        title="Open anonymous chat"
      >
        <FontAwesomeIcon icon={faComment as IconProp} size="lg" aria-hidden="true" />
        <span className="sr-only">Open anonymous chat</span>
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && setIsVisible(false)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-dialog-title"
      >
        <motion.div
          className="chat-glass-container rounded-none sm:rounded-2xl w-full max-w-4xl h-full sm:h-[85vh] max-h-[700px] flex flex-col overflow-hidden relative"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          role="document"
        >
          {/* Aurora Background Layer */}
          <div className="absolute inset-0 aurora-bg z-0 pointer-events-none opacity-50"></div>
          
          <div className="relative z-10 flex flex-col h-full w-full">
          {/* Header */}
          <div className="chat-header-glass p-4 flex items-center justify-between z-20">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-white text-lg" aria-hidden="true" />
              </div>
              <div>
                <h3 id="chat-dialog-title" className="text-white font-bold text-lg tracking-wide">Anonymous Chat</h3>
                <div className="flex items-center space-x-2 text-slate-300 text-sm">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 connection-pulse' : 'bg-red-400'}`} aria-hidden="true"></div>
                  <span role="status" aria-live="polite">{isConnected ? 'Connected' : 'Disconnected'}</span>
                  {user && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>Room: {user.roomId}</span>
                      <button
                        onClick={copyRoomId}
                        className="text-yellow-100 hover:text-white transition-colors"
                        title="Copy room code"
                        aria-label={`Copy room code ${user.roomId} to clipboard`}
                      >
                        <FontAwesomeIcon icon={faCopy as IconProp} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {user && roomInfo?.status === 'connected' && (
                <>
                  <button
                    onClick={startVoiceCall}
                    className={`text-white w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
                      isCallActive || isInitiatingCall 
                        ? 'bg-white/5 cursor-not-allowed opacity-50' 
                        : 'bg-white/10 hover:bg-yellow-500/20 hover:text-yellow-400 border border-white/5 hover:border-yellow-500/30 action-btn-hover'
                    }`}
                    title="Voice call"
                    disabled={isCallActive || isInitiatingCall}
                  >
                    <FontAwesomeIcon icon={faPhone as IconProp} aria-hidden="true" />
                  </button>
                  <button
                    onClick={startVideoCall}
                    className={`text-white w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
                      isCallActive || isInitiatingCall 
                        ? 'bg-white/5 cursor-not-allowed opacity-50' 
                        : 'bg-white/10 hover:bg-orange-500/20 hover:text-orange-400 border border-white/5 hover:border-orange-500/30 action-btn-hover'
                    }`}
                    title="Video call"
                    disabled={isCallActive || isInitiatingCall}
                  >
                    <FontAwesomeIcon icon={faVideo as IconProp} aria-hidden="true" />
                  </button>
                </>
              )}
              
              {user && (
                <button
                  onClick={leaveChat}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all duration-200 action-btn-hover"
                  title="Leave chat"
                >
                  <FontAwesomeIcon icon={faSignOutAlt as IconProp} aria-hidden="true" />
                </button>
              )}

              <button
                onClick={() => setIsVisible(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-all duration-200 action-btn-hover ml-2"
                title="Close"
              >
                <FontAwesomeIcon icon={faTimes as IconProp} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Connection/Login Screen */}
          {!user && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 z-10 flex items-center justify-center">
              <div className="w-full max-w-md bg-white/[0.02] border border-white/[0.05] p-8 rounded-2xl backdrop-blur-xl shadow-2xl">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-4 shadow-[0_0_30px_rgba(234, 179, 8,0.15)]">
                    <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-yellow-400 text-3xl" aria-hidden="true" />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-2">Join Anonymous Chat</h4>
                  <p className="text-slate-400 text-sm">Start chatting securely without revealing your identity</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label htmlFor="anonymous-name" className="sr-only">Your anonymous name</label>
                    <input
                      id="anonymous-name"
                      type="text"
                      placeholder="Enter your anonymous name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full p-4 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 outline-none text-sm chat-input-glow"
                      maxLength={50}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={createRoom}
                      disabled={isConnecting || !isConnected}
                      className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-3.5 rounded-xl font-medium shimmer-btn shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-transform hover:-translate-y-0.5"
                    >
                      {isConnecting ? 'Creating...' : 'Create Room'}
                    </button>

                    <div className="space-y-3">
                      <input
                        id="room-code"
                        type="text"
                        placeholder="Enter room code"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 outline-none text-sm chat-input-glow text-center tracking-widest font-mono"
                        maxLength={4}
                      />
                      <button
                        onClick={joinRoom}
                        disabled={isConnecting || !isConnected}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white p-3.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:-translate-y-0.5"
                      >
                        {isConnecting ? 'Joining...' : 'Join Room'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center flex-wrap gap-4 text-xs text-slate-400">
                  <div className="flex items-center space-x-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                    <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-yellow-400" />
                    <span>Anonymous</span>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                    <FontAwesomeIcon icon={faEyeSlash as IconProp} className="text-orange-400" />
                    <span>No tracking</span>
                  </div>
                </div>

                {/* Group Meeting Section */}
                <div className="mt-6 pt-6 border-t border-white/5 text-center">
                  <p className="text-slate-400 text-xs mb-3 uppercase tracking-wider font-medium">Or join with multiple people</p>
                  <button
                    onClick={() => setShowGroupMeeting(true)}
                    disabled={!isConnected}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 mx-auto w-full group hover:-translate-y-0.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-yellow-500 to-fuchsia-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FontAwesomeIcon icon={faUsersRectangle as IconProp} className="text-white text-sm" />
                    </div>
                    <span>Start Group Meeting</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Waiting for guest */}
          {user && roomInfo?.status === 'waiting' && (
            <div className="flex-1 flex items-center justify-center p-8 z-10">
              <div className="bg-white/[0.02] border border-white/[0.05] p-10 rounded-3xl backdrop-blur-xl shadow-2xl text-center max-w-md w-full">
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <div className="absolute inset-0 rounded-full border-4 border-yellow-500/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-yellow-500 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FontAwesomeIcon icon={faUsers as IconProp} className="text-yellow-400 text-3xl" />
                  </div>
                </div>
                <h4 className="text-2xl font-bold text-white mb-2">Waiting for someone...</h4>
                <p className="text-slate-400 mb-8">Share your 4-digit code to connect</p>
                
                <div 
                  className="bg-black/30 border border-white/10 rounded-2xl p-6 mb-8 cursor-pointer hover:border-yellow-500/30 hover:bg-black/40 transition-all group"
                  onClick={copyRoomId}
                  title="Click to copy"
                >
                  <span className="text-5xl tracking-[0.2em] font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 group-hover:scale-110 inline-block transition-transform duration-300 ml-[0.2em]">
                    {user.roomId}
                  </span>
                  <div className="mt-4 text-sm text-slate-500 flex items-center justify-center space-x-2">
                    <FontAwesomeIcon icon={faCopy as IconProp} className="text-yellow-400/50 group-hover:text-yellow-400 transition-colors" />
                    <span>Click to copy code</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chat Interface */}
          {user && roomInfo?.status === 'connected' && (
            <>
              {/* Chat Header with Users */}
              <div className="chat-header-glass p-4 z-20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                      <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                      <span className="text-white text-sm font-medium">
                        {roomInfo.hostName} & {roomInfo.guestName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 text-slate-300 text-sm">
                    <span className="bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                      Room: <span className="text-white font-mono tracking-wider">{user.roomId}</span>
                    </span>
                    <span className="bg-yellow-500/10 text-yellow-300 px-3 py-1.5 rounded-full border border-yellow-500/20">
                      You: {user.userName} ({user.role})
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div 
                className={`flex-1 p-4 md:p-6 overflow-y-auto messages-container relative z-10 ${
                  isDragOver ? 'bg-yellow-500/10 border-2 border-dashed border-yellow-500 shadow-[inset_0_0_50px_rgba(234, 179, 8,0.1)]' : 'bg-transparent'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
                    <div className="text-center text-yellow-400">
                      <FontAwesomeIcon icon={faFileAlt as IconProp} className="text-4xl mb-2" />
                      <p className="text-lg font-medium">Drop file to share</p>
                    </div>
                  </div>
                )}
                {messages.length === 0 && (
                  <div className="text-center text-slate-400 mt-12 flex flex-col items-center">
                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6 shadow-lg border border-white/5">
                      <FontAwesomeIcon icon={faComment as IconProp} className="text-4xl text-yellow-400/50" />
                    </div>
                    <p className="text-xl font-bold text-white mb-2">Start your anonymous conversation!</p>
                    <p className="text-sm">Share files, send messages, and communicate securely.</p>
                    <div className="mt-8 flex items-center justify-center space-x-4 text-xs">
                      <div className="flex items-center space-x-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                        <FontAwesomeIcon icon={faFileAlt as IconProp} className="text-yellow-400" />
                        <span>File sharing</span>
                      </div>
                      <div className="flex items-center space-x-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                        <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-orange-400" />
                        <span>Anonymous</span>
                      </div>
                      <div className="flex items-center space-x-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                        <FontAwesomeIcon icon={faEyeSlash as IconProp} className="text-yellow-400" />
                        <span>No tracking</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, type: "spring", stiffness: 500, damping: 20 }}
                      className={`flex ${message.senderId === socket?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`message-bubble w-fit min-w-[120px] max-w-[85%] lg:max-w-md ${
                        message.type === 'system' 
                          ? 'w-full text-center shadow-none !bg-transparent before:hidden min-w-0'
                          : message.senderId === socket?.id
                            ? 'own text-white rounded-2xl rounded-tr-sm'
                            : 'other text-slate-200 rounded-2xl rounded-tl-sm'
                      } p-3.5 flex flex-col`}>
                        
                        {message.type === 'system' ? (
                          <p className="text-yellow-400 text-sm italic">{message.content}</p>
                        ) : (
                          <>
                            <div className="flex items-baseline justify-between space-x-3 mb-1.5 border-b border-white/10 pb-1">
                              <span className="text-xs font-medium opacity-90 truncate">{message.senderName}</span>
                              <span className="text-[10px] opacity-70 shrink-0">{formatTime(message.timestamp)}</span>
                            </div>
                            
                            {message.type === 'text' && (
                              <p className="text-sm break-words leading-relaxed">{message.content}</p>
                            )}
                            
                            {message.type === 'emoji' && (
                              <p className="text-3xl leading-none pt-1 pb-1">{message.content}</p>
                            )}
                            
                            {message.type === 'file' && (
                              <div className="flex flex-col space-y-2.5 mt-1 w-full sm:w-64">
                                <div className="flex items-center space-x-3 text-sm bg-black/20 p-2.5 rounded-xl border border-white/5">
                                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                    <FontAwesomeIcon icon={faFileAlt as IconProp} className="text-lg" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate font-medium text-white">{message.fileName}</p>
                                    {message.fileSize && (
                                      <p className="text-xs opacity-70 mt-0.5">{formatFileSize(message.fileSize)}</p>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => downloadFile(message)}
                                  className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 border border-white/5 hover:border-white/20"
                                >
                                  <FontAwesomeIcon icon={faDownload as IconProp} />
                                  <span>Download File</span>
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="message-bubble other text-slate-300 p-3 flex items-center space-x-2">
                        <span className="text-sm font-medium">{roomInfo.guestName || roomInfo.hostName} is typing</span>
                        <div className="flex space-x-1 ml-1">
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full typing-dot"></div>
                          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full typing-dot"></div>
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full typing-dot"></div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="chat-header-glass border-t border-white/10 z-20">
                {/* File Preview */}
                {selectedFile && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 border-b border-white/5 bg-black/20"
                  >
                    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                          <FontAwesomeIcon 
                            icon={getFileIcon(selectedFile.name, selectedFile.type) as IconProp} 
                            className="text-white" 
                          />
                        </div>
                        <div>
                          <p className="text-white font-medium truncate max-w-48">{selectedFile.name}</p>
                          <p className="text-slate-400 text-sm">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={sendFile}
                          disabled={!roomInfo?.hostName || !roomInfo?.guestName}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-all text-sm font-medium"
                          aria-label="Send file"
                        >
                          Send
                        </button>
                        <button
                          onClick={cancelFileSelection}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg transition-all text-sm font-medium"
                          aria-label="Cancel file selection"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="p-4">
                  <div className="flex items-end space-x-2 sm:space-x-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                    aria-label="Select file to share"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!roomInfo?.hostName || !roomInfo?.guestName}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-yellow-400 p-3.5 rounded-xl transition-all action-btn-hover flex-shrink-0"
                    title={roomInfo?.hostName && roomInfo?.guestName ? "Attach file" : "Wait for both users to join"}
                  >
                    <FontAwesomeIcon icon={faPlus as IconProp} aria-hidden="true" />
                  </button>

                  <div className="flex-1 relative">
                    <label htmlFor="chat-message-input" className="sr-only">Type your message</label>
                    <input
                      id="chat-message-input"
                      type="text"
                      value={currentMessage}
                      onChange={handleTyping}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder={
                        roomInfo?.hostName && roomInfo?.guestName
                          ? `Message ${user?.role === 'host' ? roomInfo.guestName : roomInfo.hostName}...`
                          : 'Waiting for someone to join...'
                      }
                      className="w-full p-3.5 pr-12 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 outline-none chat-input-glow"
                      maxLength={1000}
                      disabled={!roomInfo?.hostName || !roomInfo?.guestName}
                      aria-describedby="message-char-count"
                    />
                    <div id="message-char-count" className="absolute right-4 top-4 text-xs text-slate-500 font-mono" aria-live="polite">
                      {currentMessage.length}/1000
                    </div>
                  </div>

                  <button
                    onClick={sendMessage}
                    disabled={!currentMessage.trim()}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white p-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20 shimmer-btn flex-shrink-0"
                    aria-label="Send message"
                  >
                    <FontAwesomeIcon icon={faPaperPlane as IconProp} aria-hidden="true" />
                  </button>
                </div>
                </div>
              </div>
            </>
          )}
          </div>
        </motion.div>

        {/* Incoming Call Modal */}
        {incomingCall && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl rounded-3xl p-8 text-center space-y-6 max-w-sm w-full mx-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Animated caller avatar */}
              <div className="relative">
                <motion.div
                  className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center shadow-[0_0_30px_rgba(234, 179, 8,0.3)] relative z-10"
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
                  className="absolute inset-0 mx-auto w-24 h-24 rounded-full border-2 border-yellow-500 z-0"
                  animate={{ scale: [1, 1.8], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 mx-auto w-24 h-24 rounded-full border-2 border-orange-500 z-0"
                  animate={{ scale: [1, 1.8], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                />
              </div>

              {/* Call type icon */}
              <div className="flex items-center justify-center space-x-2 text-yellow-400 bg-yellow-500/10 w-max mx-auto px-4 py-1.5 rounded-full border border-yellow-500/20">
                <FontAwesomeIcon 
                  icon={incomingCall.callType === 'video' ? faVideo as IconProp : faPhoneAlt as IconProp} 
                  className="text-lg" 
                />
                <span className="text-sm font-medium tracking-wide uppercase">
                  Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
                </span>
              </div>

              <div>
                <h3 className="text-white text-3xl font-bold tracking-tight">{incomingCall.callerName}</h3>
                <p className="text-slate-400 text-sm mt-2">is calling you...</p>
              </div>
              
              <div className="flex justify-center space-x-8 pt-4">
                <motion.button
                  onClick={rejectCall}
                  className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-all"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FontAwesomeIcon icon={faPhoneSlash as IconProp} className="text-2xl" />
                </motion.button>
                <motion.button
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <FontAwesomeIcon icon={faPhone as IconProp} className="text-2xl" />
                </motion.button>
              </div>

              <p className="text-slate-500 text-xs mt-4">
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
                    {/* Remote Video - Full Screen (with audio) */}
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      muted={false}
                      className="absolute inset-0 w-full h-full"
                      style={{ 
                        backgroundColor: '#1a1a1a',
                        objectFit: 'contain',
                        maxWidth: '100%',
                        maxHeight: '100%'
                      }}
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget;
                        video.muted = false;
                        video.volume = 1.0;
                        video.play().catch(err => console.log('Video onLoadedMetadata play:', err));
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
                          <span className="text-white text-xs">
                            {isScreenSharing ? 'Screen' : 'You'}
                          </span>
                          {!isScreenSharing && videoDevices.length > 1 && (
                            <span className="text-gray-400 text-xs">
                              ({currentFacingMode === 'user' ? 'Front' : 'Back'})
                            </span>
                          )}
                          {isScreenSharing && (
                            <span className="text-green-400 text-xs">(Sharing)</span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </>
                ) : (
                  /* Voice Call UI */
                  <div className="flex flex-col items-center justify-center space-y-12">
                    {/* Voice wave animation */}
                    <div className="relative">
                      <motion.div
                        className="w-36 h-36 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center shadow-[0_0_50px_rgba(234, 179, 8,0.3)] z-10 relative"
                        animate={isCallConnected ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <FontAwesomeIcon icon={faUserSecret as IconProp} className="text-white text-6xl" />
                      </motion.div>
                      
                      {/* Audio visualizer rings */}
                      {isCallConnected && (
                        <>
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-yellow-500/50 z-0"
                            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-orange-500/50 z-0"
                            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
                          />
                        </>
                      )}
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h2 className="text-white text-3xl font-bold tracking-tight">{getOtherUserName()}</h2>
                      <p className="text-yellow-400 font-mono tracking-widest uppercase text-sm">
                        {callStatus === 'ringing' && 'Calling...'}
                        {callStatus === 'connecting' && 'Connecting...'}
                        {callStatus === 'connected' && formatCallDuration(callDuration)}
                        {callStatus === 'initiating' && 'Starting call...'}
                      </p>
                    </div>

                    {/* Voice activity indicator */}
                    {isCallConnected && (
                      <div className="flex items-center space-x-1.5 bg-white/5 px-6 py-3 rounded-2xl backdrop-blur-sm border border-white/10">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="voice-wave"></div>
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
                        className="w-20 h-20 mx-auto rounded-full border-4 border-yellow-500 border-t-transparent"
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
                controls={false}
                style={{ display: 'none' }}
                onLoadedMetadata={(e) => {
                  const audio = e.currentTarget;
                  audio.volume = 1.0;
                  audio.muted = false;
                  audio.play().catch(err => console.log('Audio onLoadedMetadata play:', err));
                }}
              />

              {/* Call Controls */}
              <motion.div 
                className="absolute bottom-0 left-0 right-0 z-20 p-8 pb-12 bg-gradient-to-t from-black via-black/80 to-transparent"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-center space-x-4 max-w-md mx-auto">
                  {/* Mute Button */}
                  <motion.button
                    onClick={toggleMute}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-md ${
                      isMuted 
                        ? 'bg-red-500/20 border-red-500/30 text-red-400' 
                        : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    <FontAwesomeIcon 
                      icon={isMuted ? faMicrophoneSlash as IconProp : faMicrophone as IconProp} 
                      className="text-xl"
                    />
                  </motion.button>

                  {/* Video Toggle (only for video calls) */}
                  {callType === 'video' && (
                    <motion.button
                      onClick={toggleVideo}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-md ${
                        isVideoOff 
                          ? 'bg-red-500/20 border-red-500/30 text-red-400' 
                          : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                    >
                      <FontAwesomeIcon 
                        icon={isVideoOff ? faVideoSlash as IconProp : faVideo as IconProp} 
                        className="text-xl"
                      />
                    </motion.button>
                  )}

                  {/* Camera Switch Button (only for video calls with multiple cameras) */}
                  {callType === 'video' && videoDevices.length > 1 && !isScreenSharing && (
                    <motion.button
                      onClick={switchCamera}
                      disabled={isSwitchingCamera}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-md ${
                        isSwitchingCamera 
                          ? 'bg-white/5 border-white/5 text-slate-500 cursor-not-allowed' 
                          : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                      }`}
                      whileHover={!isSwitchingCamera ? { scale: 1.1 } : {}}
                      whileTap={!isSwitchingCamera ? { scale: 0.95 } : {}}
                      title={currentFacingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
                    >
                      <FontAwesomeIcon 
                        icon={faSyncAlt as IconProp} 
                        className={`text-xl ${isSwitchingCamera ? 'animate-spin' : ''}`}
                      />
                    </motion.button>
                  )}

                  {/* Screen Share Button (only for video calls on supported devices) */}
                  {callType === 'video' && isScreenShareSupported && (
                    <motion.button
                      onClick={toggleScreenShare}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-md ${
                        isScreenSharing 
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                          : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
                    >
                      <FontAwesomeIcon 
                        icon={faDesktop as IconProp} 
                        className="text-xl"
                      />
                    </motion.button>
                  )}

                  {/* Speaker Toggle */}
                  <motion.button
                    onClick={toggleSpeaker}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-md ${
                      !isSpeakerOn 
                        ? 'bg-red-500/20 border-red-500/30 text-red-400' 
                        : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    title={isSpeakerOn ? 'Mute speaker' : 'Unmute speaker'}
                  >
                    <FontAwesomeIcon 
                      icon={isSpeakerOn ? faVolumeUp as IconProp : faVolumeMute as IconProp} 
                      className="text-xl"
                    />
                  </motion.button>

                  {/* End Call Button */}
                  <motion.button
                    onClick={handleEndCall}
                    className="w-16 h-16 rounded-2xl bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-[0_0_30px_rgba(239,68,68,0.4)] text-white"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    title="End call"
                  >
                    <FontAwesomeIcon icon={faPhoneSlash as IconProp} className="text-2xl" />
                  </motion.button>
                </div>

                {/* Call info footer */}
                <div className="text-center mt-6">
                  <p className="text-slate-400 text-xs tracking-widest uppercase">
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

        {/* Group Meeting Modal */}
        {showGroupMeeting && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[110]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GroupMeeting
              socket={socket}
              isConnected={isConnected}
              onClose={() => setShowGroupMeeting(false)}
            />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnonymousChat;
