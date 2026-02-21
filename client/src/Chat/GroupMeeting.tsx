import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  faUsers,
  faTimes,
  faVideo,
  faVideoSlash,
  faMicrophone,
  faMicrophoneSlash,
  faPhoneSlash,
  faExpand,
  faCompress,
  faComments,
  faPaperPlane,
  faCopy,
  faDesktop,
  faUserPlus
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';

interface Participant {
  socketId: string;
  userName: string;
  isHost: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  stream?: MediaStream;
}

interface MeetingMessage {
  senderId: string;
  senderName: string;
  type: 'text' | 'system';
  content: string;
  timestamp: Date;
}

interface PeerConnection {
  socketId: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
}

interface GroupMeetingProps {
  socket: Socket | null;
  isConnected: boolean;
  onClose: () => void;
}

const GroupMeeting: React.FC<GroupMeetingProps> = ({ socket, isConnected, onClose }) => {
  // Meeting state
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [meetingName, setMeetingName] = useState('');
  const [userName, setUserName] = useState('');
  const [inputMeetingId, setInputMeetingId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showChat, setShowChat] = useState(false);

  // Media state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isScreenShareSupported, setIsScreenShareSupported] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const meetingContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // ICE servers configuration
  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
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
    iceCandidatePoolSize: 10
  };

  // Check screen share support
  useEffect(() => {
    const hasGetDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsScreenShareSupported(hasGetDisplayMedia && !isMobile);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create peer connection for a participant
  const createPeerConnection = useCallback((targetSocketId: string, targetUserName: string): RTCPeerConnection => {
    console.log(`Creating peer connection for ${targetUserName} (${targetSocketId})`);
    
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('meeting-ice-candidate', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received track from ${targetUserName}:`, event.track.kind);
      if (event.streams && event.streams[0]) {
        setParticipants(prev => prev.map(p => 
          p.socketId === targetSocketId 
            ? { ...p, stream: event.streams[0] } 
            : p
        ));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state for ${targetUserName}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    // Add local tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    peerConnectionsRef.current.set(targetSocketId, { socketId: targetSocketId, pc });
    
    return pc;
  }, [socket, iceServers]);

  // Initialize connection to a peer
  const initiatePeerConnection = useCallback(async (targetSocketId: string, targetUserName: string) => {
    if (!socket) return;

    const pc = createPeerConnection(targetSocketId, targetUserName);
    
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      socket.emit('meeting-webrtc-offer', {
        targetSocketId,
        offer: pc.localDescription
      });
      console.log(`Sent offer to ${targetUserName}`);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [socket, createPeerConnection]);

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    // Meeting created
    socket.on('meeting-created', (data) => {
      console.log('Meeting created:', data);
      setIsInMeeting(true);
      setMeetingId(data.meetingId);
      setMeetingName(data.meetingName);
      setIsHost(data.isHost);
      setParticipants(data.participants.map((p: Participant) => ({
        ...p,
        stream: p.socketId === socket.id ? localStreamRef.current : undefined
      })));
      toast.success(`Meeting created! ID: ${data.meetingId}`);
    });

    // Meeting joined
    socket.on('meeting-joined', (data) => {
      console.log('Meeting joined:', data);
      setIsInMeeting(true);
      setMeetingId(data.meetingId);
      setMeetingName(data.meetingName);
      setIsHost(data.isHost);
      setParticipants(data.participants.map((p: Participant) => ({
        ...p,
        stream: p.socketId === socket.id ? localStreamRef.current : undefined
      })));
      setMessages(data.messages || []);
      toast.success('Joined the meeting!');

      // Request peer connections with existing participants
      data.participants.forEach((p: Participant) => {
        if (p.socketId !== socket.id) {
          socket.emit('meeting-request-peer-connection', { targetSocketId: p.socketId });
        }
      });
    });

    // New participant joined
    socket.on('participant-joined', async (data) => {
      console.log('Participant joined:', data);
      setParticipants(data.participants.map((p: Participant) => {
        const existing = peerConnectionsRef.current.get(p.socketId);
        return {
          ...p,
          stream: p.socketId === socket.id ? localStreamRef.current : existing?.stream
        };
      }));
      toast.success(`${data.userName} joined the meeting`);
    });

    // Peer connection request - initiate connection
    socket.on('meeting-peer-connection-request', async (data) => {
      console.log('Peer connection request from:', data.userName);
      await initiatePeerConnection(data.from, data.userName);
    });

    // WebRTC offer received
    socket.on('meeting-webrtc-offer', async (data) => {
      console.log('Received offer from:', data.userName);
      
      let pc = peerConnectionsRef.current.get(data.from)?.pc;
      if (!pc) {
        pc = createPeerConnection(data.from, data.userName);
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // Process pending ICE candidates
        const pending = pendingCandidatesRef.current.get(data.from) || [];
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current.delete(data.from);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('meeting-webrtc-answer', {
          targetSocketId: data.from,
          answer: pc.localDescription
        });
        console.log('Sent answer to:', data.userName);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    // WebRTC answer received
    socket.on('meeting-webrtc-answer', async (data) => {
      console.log('Received answer from:', data.userName);
      const peerConn = peerConnectionsRef.current.get(data.from);
      
      if (peerConn?.pc && peerConn.pc.signalingState === 'have-local-offer') {
        try {
          await peerConn.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          
          // Process pending ICE candidates
          const pending = pendingCandidatesRef.current.get(data.from) || [];
          for (const candidate of pending) {
            await peerConn.pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current.delete(data.from);
        } catch (error) {
          console.error('Error setting answer:', error);
        }
      }
    });

    // ICE candidate received
    socket.on('meeting-ice-candidate', async (data) => {
      const peerConn = peerConnectionsRef.current.get(data.from);
      
      if (peerConn?.pc && peerConn.pc.remoteDescription) {
        try {
          await peerConn.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      } else {
        // Queue the candidate
        if (!pendingCandidatesRef.current.has(data.from)) {
          pendingCandidatesRef.current.set(data.from, []);
        }
        pendingCandidatesRef.current.get(data.from)?.push(data.candidate);
      }
    });

    // Participant left
    socket.on('participant-left', (data) => {
      console.log('Participant left:', data.userName);
      setParticipants(data.participants.map((p: Participant) => {
        const existing = peerConnectionsRef.current.get(p.socketId);
        return {
          ...p,
          stream: p.socketId === socket.id ? localStreamRef.current : existing?.stream
        };
      }));
      
      // Close peer connection
      const peerConn = peerConnectionsRef.current.get(data.socketId);
      if (peerConn) {
        peerConn.pc.close();
        peerConnectionsRef.current.delete(data.socketId);
      }
      
      toast(`${data.userName} left the meeting`);
    });

    // Participant mute changed
    socket.on('participant-mute-changed', (data) => {
      setParticipants(prev => prev.map(p =>
        p.socketId === data.socketId ? { ...p, isMuted: data.isMuted } : p
      ));
    });

    // Participant video changed
    socket.on('participant-video-changed', (data) => {
      setParticipants(prev => prev.map(p =>
        p.socketId === data.socketId ? { ...p, isVideoOff: data.isVideoOff } : p
      ));
    });

    // New message
    socket.on('meeting-new-message', (data) => {
      setMessages(prev => [...prev, { ...data, timestamp: new Date(data.timestamp) }]);
    });

    // Meeting left
    socket.on('meeting-left', () => {
      cleanupMeeting();
      toast('You left the meeting');
    });

    // New host assigned
    socket.on('new-host-assigned', (data) => {
      if (data.socketId === socket.id) {
        setIsHost(true);
        toast.success('You are now the host');
      }
      setParticipants(prev => prev.map(p => ({
        ...p,
        isHost: p.socketId === data.socketId
      })));
    });

    return () => {
      socket.off('meeting-created');
      socket.off('meeting-joined');
      socket.off('participant-joined');
      socket.off('meeting-peer-connection-request');
      socket.off('meeting-webrtc-offer');
      socket.off('meeting-webrtc-answer');
      socket.off('meeting-ice-candidate');
      socket.off('participant-left');
      socket.off('participant-mute-changed');
      socket.off('participant-video-changed');
      socket.off('meeting-new-message');
      socket.off('meeting-left');
      socket.off('new-host-assigned');
    };
  }, [socket, createPeerConnection, initiatePeerConnection]);

  // Get local media stream
  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Error getting media:', error);
      toast.error('Failed to access camera/microphone');
      return null;
    }
  };

  // Create meeting
  const createMeeting = async () => {
    if (!userName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!socket || !isConnected) {
      toast.error('Not connected to server');
      return;
    }

    const stream = await getLocalStream();
    if (!stream) return;

    socket.emit('create-meeting', {
      userName: userName.trim(),
      meetingName: meetingName.trim() || `${userName.trim()}'s Meeting`,
      meetingType: 'video'
    });
  };

  // Join meeting
  const joinMeeting = async () => {
    if (!userName.trim() || !inputMeetingId.trim()) {
      toast.error('Please enter your name and meeting ID');
      return;
    }

    if (!socket || !isConnected) {
      toast.error('Not connected to server');
      return;
    }

    const stream = await getLocalStream();
    if (!stream) return;

    socket.emit('join-meeting', {
      meetingId: inputMeetingId.trim(),
      userName: userName.trim()
    });
  };

  // Leave meeting
  const leaveMeeting = () => {
    if (socket) {
      socket.emit('leave-meeting');
    }
    cleanupMeeting();
    onClose();
  };

  // Cleanup meeting resources
  const cleanupMeeting = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    // Stop screen share
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(({ pc }) => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    // Reset state
    setIsInMeeting(false);
    setMeetingId('');
    setMeetingName('');
    setParticipants([]);
    setMessages([]);
    setIsHost(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
  };

  // Toggle mute
  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        socket?.emit('meeting-toggle-mute', { isMuted: !audioTrack.enabled });
        toast(audioTrack.enabled ? 'Unmuted' : 'Muted', { icon: audioTrack.enabled ? '🎤' : '🔇' });
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        socket?.emit('meeting-toggle-video', { isVideoOff: !videoTrack.enabled });
        toast(videoTrack.enabled ? 'Camera on' : 'Camera off', { icon: videoTrack.enabled ? '📹' : '📷' });
      }
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    if (!isScreenShareSupported) {
      toast.error('Screen sharing not supported on mobile');
      return;
    }

    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        // Get camera stream again
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        const newVideoTrack = cameraStream.getVideoTracks()[0];

        // Replace track in all peer connections
        peerConnectionsRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          }
        });

        // Update local stream
        const currentStream = localStreamRef.current;
        if (currentStream) {
          const oldVideoTrack = currentStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            currentStream.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }
          currentStream.addTrack(newVideoTrack);
        }

        if (localVideoRef.current && currentStream) {
          localVideoRef.current.srcObject = currentStream;
        }

        setIsScreenSharing(false);
        toast.success('Stopped screen sharing');
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as MediaTrackConstraints,
          audio: false
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        screenTrack.onended = () => {
          if (isScreenSharing) {
            toggleScreenShare();
          }
        };

        // Replace track in all peer connections
        peerConnectionsRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      }
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to toggle screen sharing');
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && meetingContainerRef.current) {
      meetingContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Copy meeting ID
  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    toast.success('Meeting ID copied!');
  };

  // Send message
  const sendMessage = () => {
    if (!currentMessage.trim() || !socket) return;
    socket.emit('meeting-message', { message: currentMessage.trim() });
    setCurrentMessage('');
  };

  // Render video grid
  const renderVideoGrid = () => {
    const gridCols = participants.length <= 1 ? 1 : participants.length <= 4 ? 2 : 3;
    
    return (
      <div 
        className={`grid gap-2 p-4 h-full w-full ${
          gridCols === 1 ? 'grid-cols-1' : 
          gridCols === 2 ? 'grid-cols-2' : 
          'grid-cols-3'
        }`}
        style={{ gridAutoRows: '1fr' }}
      >
        {participants.map((participant) => (
          <div
            key={participant.socketId}
            className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center"
          >
            {participant.socketId === socket?.id ? (
              // Local video
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
              />
            ) : (
              // Remote video
              <ParticipantVideo participant={participant} />
            )}

            {/* Video off placeholder */}
            {((participant.socketId === socket?.id && isVideoOff) || 
              (participant.socketId !== socket?.id && participant.isVideoOff)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    {participant.userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {/* Participant info overlay */}
            <div className="absolute bottom-2 left-2 bg-black/60 rounded px-2 py-1 flex items-center space-x-2">
              {((participant.socketId === socket?.id && isMuted) || participant.isMuted) && (
                <FontAwesomeIcon icon={faMicrophoneSlash as IconProp} className="text-red-400 text-xs" />
              )}
              <span className="text-white text-xs">
                {participant.userName} {participant.isHost && '(Host)'}
                {participant.socketId === socket?.id && ' (You)'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Lobby view (not in meeting)
  if (!isInMeeting) {
    return (
      <motion.div
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 w-full max-w-md"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <FontAwesomeIcon icon={faUsers as IconProp} className="text-white" />
            </div>
            <h3 className="text-white font-bold text-xl">Group Meeting</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes as IconProp} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Your Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 outline-none"
              maxLength={50}
            />
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-400 text-sm mb-3">Create a new meeting</p>
            <div className="space-y-3">
              <input
                type="text"
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
                placeholder="Meeting name (optional)"
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 outline-none"
                maxLength={100}
              />
              <button
                onClick={createMeeting}
                disabled={!isConnected}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white p-3 rounded-lg font-medium hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <FontAwesomeIcon icon={faVideo as IconProp} />
                <span>Create Meeting</span>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-400 text-sm mb-3">Or join an existing meeting</p>
            <div className="space-y-3">
              <input
                type="text"
                value={inputMeetingId}
                onChange={(e) => setInputMeetingId(e.target.value)}
                placeholder="Enter meeting ID"
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 outline-none"
                maxLength={6}
              />
              <button
                onClick={joinMeeting}
                disabled={!isConnected}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <FontAwesomeIcon icon={faUserPlus as IconProp} />
                <span>Join Meeting</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Meeting view
  return (
    <motion.div
      ref={meetingContainerRef}
      className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black z-[100]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-4">
              <h2 className="text-white font-bold">{meetingName}</h2>
              {isHost && (
                <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium">Host</span>
              )}
              <div className="flex items-center space-x-2 bg-black/50 rounded-full px-3 py-1">
                <span className="text-gray-300 text-sm">ID: {meetingId}</span>
                <button
                  onClick={copyMeetingId}
                  className="text-amber-400 hover:text-amber-300"
                  title="Copy meeting ID"
                >
                  <FontAwesomeIcon icon={faCopy as IconProp} className="text-xs" />
                </button>
              </div>
              <div className="flex items-center space-x-2 text-gray-400 text-sm">
                <FontAwesomeIcon icon={faUsers as IconProp} />
                <span>{participants.length}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-2 rounded-lg transition-all ${
                  showChat ? 'bg-amber-500 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Toggle chat"
              >
                <FontAwesomeIcon icon={faComments as IconProp} />
              </button>
              <button
                onClick={toggleFullscreen}
                className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <FontAwesomeIcon icon={isFullscreen ? faCompress as IconProp : faExpand as IconProp} />
              </button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex pt-16 pb-24">
          {/* Video grid */}
          <div className={`flex-1 ${showChat ? 'mr-80' : ''} transition-all duration-300`}>
            {renderVideoGrid()}
          </div>

          {/* Chat sidebar */}
          <AnimatePresence>
            {showChat && (
              <motion.div
                className="absolute right-0 top-16 bottom-24 w-80 bg-gray-900/95 border-l border-gray-700 flex flex-col"
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
              >
                <div className="p-3 border-b border-gray-700">
                  <h4 className="text-white font-medium">Meeting Chat</h4>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.map((msg, i) => (
                    <div key={i} className={msg.type === 'system' ? 'text-center' : ''}>
                      {msg.type === 'system' ? (
                        <span className="text-amber-400 text-xs italic">{msg.content}</span>
                      ) : (
                        <div className={`${msg.senderId === socket?.id ? 'text-right' : ''}`}>
                          <span className="text-gray-400 text-xs">{msg.senderName}</span>
                          <div className={`rounded-lg p-2 mt-1 ${
                            msg.senderId === socket?.id 
                              ? 'bg-amber-500 text-white ml-auto' 
                              : 'bg-gray-700 text-white'
                          } max-w-[80%] inline-block`}>
                            <p className="text-sm">{msg.content}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t border-gray-700">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 p-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 text-sm focus:border-amber-500 outline-none"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!currentMessage.trim()}
                      className="bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-lg disabled:opacity-50"
                    >
                      <FontAwesomeIcon icon={faPaperPlane as IconProp} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center space-x-4 max-w-md mx-auto">
            <motion.button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <FontAwesomeIcon
                icon={isMuted ? faMicrophoneSlash as IconProp : faMicrophone as IconProp}
                className="text-white text-xl"
              />
            </motion.button>

            <motion.button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
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

            {isScreenShareSupported && (
              <motion.button
                onClick={toggleScreenShare}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isScreenSharing ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <FontAwesomeIcon icon={faDesktop as IconProp} className="text-white text-xl" />
              </motion.button>
            )}

            <motion.button
              onClick={leaveMeeting}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title="Leave meeting"
            >
              <FontAwesomeIcon icon={faPhoneSlash as IconProp} className="text-white text-2xl" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Separate component for participant video to handle refs properly
const ParticipantVideo: React.FC<{ participant: Participant }> = ({ participant }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={`w-full h-full object-cover ${participant.isVideoOff ? 'hidden' : ''}`}
    />
  );
};

export default GroupMeeting;
