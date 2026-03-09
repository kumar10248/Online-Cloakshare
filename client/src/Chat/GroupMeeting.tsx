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
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

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

  // Effect to ensure local video is attached when in meeting
  useEffect(() => {
    if (isInMeeting && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
    }
  }, [isInMeeting]);

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
      console.log(`Received track from ${targetUserName}:`, event.track.kind, 'streams:', event.streams.length);
      
      let remoteStream: MediaStream;
      
      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
      } else {
        // Handle case where track arrives without associated stream
        // Create a new MediaStream and add the track to it
        console.log(`No stream associated with track from ${targetUserName}, creating new stream`);
        const peerConn = peerConnectionsRef.current.get(targetSocketId);
        if (peerConn?.stream) {
          // Add track to existing stream
          remoteStream = peerConn.stream;
          if (!remoteStream.getTracks().includes(event.track)) {
            remoteStream.addTrack(event.track);
          }
        } else {
          // Create new stream
          remoteStream = new MediaStream([event.track]);
        }
      }
      
      console.log(`Setting remote stream for ${targetUserName}, tracks:`, remoteStream.getTracks().map(t => t.kind));
      
      // Update the peer connection's stream reference
      const peerConn = peerConnectionsRef.current.get(targetSocketId);
      if (peerConn) {
        peerConn.stream = remoteStream;
      }
      
      // Update participants state with the new stream
      setParticipants(prev => {
        const updated = prev.map(p => 
          p.socketId === targetSocketId 
            ? { ...p, stream: remoteStream } 
            : p
        );
        console.log(`Updated participants, ${targetUserName} now has stream:`, updated.find(p => p.socketId === targetSocketId)?.stream ? 'yes' : 'no');
        return updated;
      });
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state for ${targetUserName}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${targetUserName}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log(`Successfully connected to ${targetUserName}`);
      }
    };

    pc.onnegotiationneeded = () => {
      console.log(`Negotiation needed for ${targetUserName}`);
    };

    // Add local tracks
    const stream = localStreamRef.current;
    if (stream) {
      console.log(`Adding ${stream.getTracks().length} local tracks to peer connection for ${targetUserName}`);
      stream.getTracks().forEach(track => {
        console.log(`Adding track: ${track.kind} to ${targetUserName}`);
        pc.addTrack(track, stream);
      });
    } else {
      console.warn(`No local stream available when creating peer connection for ${targetUserName}`);
    }

    peerConnectionsRef.current.set(targetSocketId, { socketId: targetSocketId, pc });
    
    return pc;
  }, [socket, iceServers]);

  // Initialize connection to a peer
  const initiatePeerConnection = useCallback(async (targetSocketId: string, targetUserName: string) => {
    if (!socket) return;

    // Check if we already have a connection to this peer
    const existingConn = peerConnectionsRef.current.get(targetSocketId);
    if (existingConn && existingConn.pc.signalingState !== 'closed') {
      console.log(`Already have connection to ${targetUserName}, skipping`);
      return;
    }

    const pc = createPeerConnection(targetSocketId, targetUserName);
    
    try {
      // Add transceivers to ensure bi-directional communication
      if (pc.getTransceivers().length === 0) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      socket.emit('meeting-webrtc-offer', {
        targetSocketId,
        offer: pc.localDescription
      });
      console.log(`Sent offer to ${targetUserName}, SDP length: ${offer.sdp?.length}`);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [socket, createPeerConnection]);

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    // Error handler for meeting errors
    const handleError = (data: { message: string }) => {
      console.error('Meeting error:', data.message);
      toast.error(data.message || 'An error occurred');
      setIsCreating(false);
      setIsJoining(false);
    };
    socket.on('error', handleError);

    // Meeting created
    socket.on('meeting-created', (data) => {
      console.log('Meeting created:', data);
      setIsCreating(false);
      setIsInMeeting(true);
      setMeetingId(data.meetingId);
      setMeetingName(data.meetingName);
      setIsHost(data.isHost);
      setParticipants(data.participants.map((p: Participant) => ({
        ...p,
        stream: p.socketId === socket.id ? localStreamRef.current : undefined
      })));
      toast.success(`Meeting created! ID: ${data.meetingId}`);
      
      // Ensure local video is displayed
      setTimeout(() => {
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
        }
      }, 100);
    });

    // Meeting joined
    socket.on('meeting-joined', (data) => {
      console.log('Meeting joined:', data);
      setIsJoining(false);
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
      
      // Ensure local video is displayed
      setTimeout(() => {
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
        }
      }, 100);

      // Request peer connections with existing participants after a delay
      // This gives existing participants time to set up first
      setTimeout(() => {
        data.participants.forEach((p: Participant) => {
          if (p.socketId !== socket.id) {
            // Check if connection already exists (may have been initiated by existing participant)
            const existingConn = peerConnectionsRef.current.get(p.socketId);
            if (!existingConn || existingConn.pc.signalingState === 'closed') {
              console.log('Requesting peer connection with:', p.userName);
              socket.emit('meeting-request-peer-connection', { targetSocketId: p.socketId });
            } else {
              console.log('Connection already exists with:', p.userName, 'state:', existingConn.pc.signalingState);
            }
          }
        });
      }, 1000);
    });

    // New participant joined
    socket.on('participant-joined', async (data) => {
      console.log('Participant joined:', data.userName, 'socketId:', data.socketId);
      console.log('Current peer connections:', Array.from(peerConnectionsRef.current.keys()));
      
      setParticipants(prev => {
        // Map through the new participants list and preserve existing streams
        const updated = data.participants.map((p: Participant) => {
          // Check if we have an existing stream for this participant
          const existingParticipant = prev.find(ep => ep.socketId === p.socketId);
          const peerConn = peerConnectionsRef.current.get(p.socketId);
          
          return {
            ...p,
            stream: p.socketId === socket.id 
              ? localStreamRef.current 
              : existingParticipant?.stream || peerConn?.stream || undefined
          };
        });
        
        console.log('Updated participants after join:', updated.map((p: Participant) => ({ socketId: p.socketId, hasStream: !!p.stream })));
        return updated;
      });
      
      toast.success(`${data.userName} joined the meeting`);
      
      // Existing participants should initiate peer connection with the new joiner
      // This ensures bidirectional video/audio communication
      if (data.socketId !== socket.id) {
        console.log('Initiating peer connection with new participant:', data.userName);
        // Small delay to ensure the new participant is ready
        setTimeout(() => {
          initiatePeerConnection(data.socketId, data.userName);
        }, 500);
      }
    });

    // Peer connection request - initiate connection
    socket.on('meeting-peer-connection-request', async (data) => {
      console.log('Peer connection request from:', data.userName);
      await initiatePeerConnection(data.from, data.userName);
    });

    // WebRTC offer received
    socket.on('meeting-webrtc-offer', async (data) => {
      console.log('Received offer from:', data.userName, 'from:', data.from);
      
      // Check if we already have a peer connection with a different state
      let peerConn = peerConnectionsRef.current.get(data.from);
      let pc = peerConn?.pc;
      
      if (!pc || pc.signalingState === 'closed') {
        pc = createPeerConnection(data.from, data.userName);
      } else if (pc.signalingState !== 'stable') {
        // Handle glare (both sides tried to create offer simultaneously)
        console.log(`Glare detected with ${data.userName}, signaling state: ${pc.signalingState}`);
        // If we have a higher socket id, we ignore the incoming offer
        if (socket.id && socket.id > data.from) {
          console.log('Ignoring offer due to glare resolution (we have higher id)');
          return;
        }
        // Otherwise, close the existing connection and create a new one
        pc.close();
        pc = createPeerConnection(data.from, data.userName);
      }

      try {
        console.log(`Setting remote description for ${data.userName}, current state: ${pc.signalingState}`);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log(`Remote description set for ${data.userName}, new state: ${pc.signalingState}`);
        
        // Process pending ICE candidates
        const pending = pendingCandidatesRef.current.get(data.from) || [];
        console.log(`Processing ${pending.length} pending ICE candidates for ${data.userName}`);
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current.delete(data.from);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`Created and set answer for ${data.userName}, SDP length: ${answer.sdp?.length}`);

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
      console.log('Received answer from:', data.userName, 'from:', data.from);
      const peerConn = peerConnectionsRef.current.get(data.from);
      
      if (!peerConn?.pc) {
        console.warn(`No peer connection found for ${data.userName}`);
        return;
      }
      
      console.log(`Current signaling state for ${data.userName}: ${peerConn.pc.signalingState}`);
      
      if (peerConn.pc.signalingState === 'have-local-offer') {
        try {
          await peerConn.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log(`Remote description (answer) set for ${data.userName}, new state: ${peerConn.pc.signalingState}`);
          
          // Process pending ICE candidates
          const pending = pendingCandidatesRef.current.get(data.from) || [];
          console.log(`Processing ${pending.length} pending ICE candidates for ${data.userName}`);
          for (const candidate of pending) {
            await peerConn.pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current.delete(data.from);
        } catch (error) {
          console.error('Error setting answer:', error);
        }
      } else {
        console.warn(`Ignoring answer from ${data.userName}, not in have-local-offer state`);
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
      console.log('Participant left:', data.userName, 'socketId:', data.socketId);
      
      // Close peer connection first
      const peerConn = peerConnectionsRef.current.get(data.socketId);
      if (peerConn) {
        peerConn.pc.close();
        peerConnectionsRef.current.delete(data.socketId);
      }
      
      setParticipants(prev => {
        // Map through the updated participants list and preserve existing streams
        const updated = data.participants.map((p: Participant) => {
          const existingParticipant = prev.find(ep => ep.socketId === p.socketId);
          const existingPeerConn = peerConnectionsRef.current.get(p.socketId);
          return {
            ...p,
            stream: p.socketId === socket.id 
              ? localStreamRef.current 
              : existingParticipant?.stream || existingPeerConn?.stream || undefined
          };
        });
        return updated;
      });
      
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

    // Participant screen share changed
    socket.on('participant-screen-share-changed', (data) => {
      if (data.isScreenSharing) {
        toast(`${data.userName} is sharing their screen`, { icon: '🖥️' });
      } else {
        toast(`${data.userName} stopped sharing`, { icon: '📹' });
      }
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
      socket.off('error', handleError);
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
      socket.off('participant-screen-share-changed');
      socket.off('meeting-new-message');
      socket.off('meeting-left');
      socket.off('new-host-assigned');
    };
  }, [socket, createPeerConnection, initiatePeerConnection]);

  // Get local media stream
  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true
        },
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
      toast.error('Failed to access camera/microphone. Please check permissions.');
      return null;
    }
  };

  // Create meeting
  const createMeeting = async () => {
    if (!userName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!socket) {
      toast.error('Socket not initialized. Please refresh the page.');
      console.error('Socket is null');
      return;
    }

    if (!isConnected) {
      toast.error('Not connected to server. Please check your internet connection.');
      console.error('Socket not connected');
      return;
    }

    setIsCreating(true);
    console.log('Creating meeting with socket:', socket.id);

    try {
      const stream = await getLocalStream();
      if (!stream) {
        setIsCreating(false);
        return;
      }

      console.log('Got local stream, emitting create-meeting event');
      socket.emit('create-meeting', {
        userName: userName.trim(),
        meetingName: meetingName.trim() || `${userName.trim()}'s Meeting`,
        meetingType: 'video'
      });
      
      // Set a timeout to reset loading state if no response
      setTimeout(() => {
        setIsCreating(false);
      }, 10000);
    } catch (error) {
      console.error('Error in createMeeting:', error);
      toast.error('Failed to create meeting');
      setIsCreating(false);
    }
  };

  // Join meeting
  const joinMeeting = async () => {
    if (!userName.trim() || !inputMeetingId.trim()) {
      toast.error('Please enter your name and meeting ID');
      return;
    }

    if (!socket) {
      toast.error('Socket not initialized. Please refresh the page.');
      console.error('Socket is null');
      return;
    }

    if (!isConnected) {
      toast.error('Not connected to server. Please check your internet connection.');
      console.error('Socket not connected');
      return;
    }

    setIsJoining(true);
    console.log('Joining meeting with socket:', socket.id, 'Meeting ID:', inputMeetingId.trim());

    try {
      const stream = await getLocalStream();
      if (!stream) {
        setIsJoining(false);
        return;
      }

      console.log('Got local stream, emitting join-meeting event');
      socket.emit('join-meeting', {
        meetingId: inputMeetingId.trim(),
        userName: userName.trim()
      });
      
      // Set a timeout to reset loading state if no response
      setTimeout(() => {
        setIsJoining(false);
      }, 10000);
    } catch (error) {
      console.error('Error in joinMeeting:', error);
      toast.error('Failed to join meeting');
      setIsJoining(false);
    }
  };

  // Leave meeting
  const leaveMeeting = () => {
    if (socket) {
      socket.emit('leave-meeting');
    }
    cleanupMeeting();
    // Don't close - just reset to lobby view so user can rejoin
    // onClose(); // Commented out to allow rejoin
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

    // Reset state but keep userName and inputMeetingId for easier rejoin
    setIsInMeeting(false);
    setMeetingId('');
    setMeetingName('');
    setParticipants([]);
    setMessages([]);
    setIsHost(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setIsCreating(false);
    setIsJoining(false);
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
        socket?.emit('meeting-screen-share-changed', { isScreenSharing: false });
        toast.success('Stopped screen sharing');
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as MediaTrackConstraints,
          audio: false
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Handle when user stops sharing via browser UI
        screenTrack.onended = async () => {
          // Stop screen sharing and switch back to camera
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
          }

          try {
            const cameraStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            const newVideoTrack = cameraStream.getVideoTracks()[0];

            peerConnectionsRef.current.forEach(({ pc }) => {
              const sender = pc.getSenders().find(s => s.track?.kind === 'video');
              if (sender) {
                sender.replaceTrack(newVideoTrack);
              }
            });

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
          } catch (err) {
            console.error('Error switching back to camera:', err);
          }

          setIsScreenSharing(false);
          socket?.emit('meeting-screen-share-changed', { isScreenSharing: false });
          toast.success('Stopped screen sharing');
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
        socket?.emit('meeting-screen-share-changed', { isScreenSharing: true });
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
    const participantCount = participants.length;
    
    // Determine grid layout based on participant count
    let gridClass = '';
    let containerStyle = '';
    if (participantCount === 1) {
      gridClass = 'grid-cols-1';
      containerStyle = 'max-w-3xl mx-auto';
    } else if (participantCount === 2) {
      gridClass = 'grid-cols-1 md:grid-cols-2';
      containerStyle = 'max-w-5xl mx-auto';
    } else if (participantCount <= 4) {
      gridClass = 'grid-cols-2';
      containerStyle = 'max-w-5xl mx-auto';
    } else if (participantCount <= 6) {
      gridClass = 'grid-cols-2 md:grid-cols-3';
      containerStyle = 'max-w-6xl mx-auto';
    } else {
      gridClass = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
      containerStyle = '';
    }
    
    return (
      <div 
        className={`grid gap-3 p-4 h-full w-full ${gridClass} ${containerStyle}`}
        style={{ gridAutoRows: 'minmax(150px, 1fr)' }}
      >
        {participants.map((participant) => (
          <div
            key={participant.socketId}
            className="relative bg-gray-800 rounded-xl overflow-hidden min-h-[150px] md:min-h-[200px]"
            style={{ aspectRatio: '16/9' }}
          >
            {participant.socketId === socket?.id ? (
              // Local video
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
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
              {/* Screen sharing indicator */}
              {participant.socketId === socket?.id && isScreenSharing && (
                <FontAwesomeIcon icon={faDesktop as IconProp} className="text-green-400 text-xs" />
              )}
              <span className="text-white text-xs">
                {participant.userName} {participant.isHost && '(Host)'}
                {participant.socketId === socket?.id && ' (You)'}
              </span>
            </div>
            
            {/* Screen sharing banner */}
            {participant.socketId === socket?.id && isScreenSharing && (
              <div className="absolute top-2 left-2 right-2 bg-green-500/90 rounded px-3 py-1.5 flex items-center justify-center space-x-2">
                <FontAwesomeIcon icon={faDesktop as IconProp} className="text-white text-sm" />
                <span className="text-white text-sm font-medium">You are sharing your screen</span>
              </div>
            )}
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
                disabled={!isConnected || isCreating}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white p-3 rounded-lg font-medium hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faVideo as IconProp} />
                    <span>Create Meeting</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-400 text-sm mb-3">Or join an existing meeting</p>
            <div className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputMeetingId}
                onChange={(e) => {
                  // Only allow digits and max 6 characters
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setInputMeetingId(value);
                }}
                placeholder="Enter 6-digit meeting ID"
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-amber-500 outline-none text-center text-lg tracking-widest"
                maxLength={6}
              />
              <button
                onClick={joinMeeting}
                disabled={!isConnected || isJoining}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isJoining ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Joining...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUserPlus as IconProp} />
                    <span>Join Meeting</span>
                  </>
                )}
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
        <div className="absolute top-0 left-0 right-0 z-20 p-3 md:p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-2 md:space-x-4 flex-wrap">
              <h2 className="text-white font-bold text-sm md:text-base truncate max-w-[120px] md:max-w-none">{meetingName}</h2>
              {isHost && (
                <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Host</span>
              )}
              <div className="flex items-center space-x-1 md:space-x-2 bg-black/50 rounded-full px-2 md:px-3 py-1">
                <span className="text-gray-300 text-xs md:text-sm">ID: {meetingId}</span>
                <button
                  onClick={copyMeetingId}
                  className="text-amber-400 hover:text-amber-300"
                  title="Copy meeting ID"
                >
                  <FontAwesomeIcon icon={faCopy as IconProp} className="text-xs" />
                </button>
              </div>
              <div className="flex items-center space-x-1 text-gray-400 text-xs md:text-sm">
                <FontAwesomeIcon icon={faUsers as IconProp} />
                <span>{participants.length}</span>
              </div>
            </div>

            <div className="flex items-center space-x-1 md:space-x-2">
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
                className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 hidden md:block"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <FontAwesomeIcon icon={isFullscreen ? faCompress as IconProp : faExpand as IconProp} />
              </button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex pt-16 pb-24 overflow-hidden">
          {/* Video grid */}
          <div className={`flex-1 overflow-auto ${showChat ? 'md:mr-80' : ''} transition-all duration-300`}>
            {renderVideoGrid()}
          </div>

          {/* Chat sidebar - full screen on mobile, sidebar on desktop */}
          <AnimatePresence>
            {showChat && (
              <motion.div
                className="fixed md:absolute inset-0 md:inset-auto md:right-0 md:top-16 md:bottom-24 md:w-80 bg-gray-900/98 md:bg-gray-900/95 md:border-l border-gray-700 flex flex-col z-30"
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
              >
                <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                  <h4 className="text-white font-medium">Meeting Chat</h4>
                  <button
                    onClick={() => setShowChat(false)}
                    className="text-gray-400 hover:text-white p-1 md:hidden"
                  >
                    <FontAwesomeIcon icon={faTimes as IconProp} />
                  </button>
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
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gradient-to-t from-black/90 to-transparent">
          <div className="flex items-center justify-center space-x-3 md:space-x-4 max-w-md mx-auto">
            <motion.button
              onClick={toggleMute}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <FontAwesomeIcon
                icon={isMuted ? faMicrophoneSlash as IconProp : faMicrophone as IconProp}
                className="text-white text-lg md:text-xl"
              />
            </motion.button>

            <motion.button
              onClick={toggleVideo}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              <FontAwesomeIcon
                icon={isVideoOff ? faVideoSlash as IconProp : faVideo as IconProp}
                className="text-white text-lg md:text-xl"
              />
            </motion.button>

            {isScreenShareSupported && (
              <motion.button
                onClick={toggleScreenShare}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isScreenSharing ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <FontAwesomeIcon icon={faDesktop as IconProp} className="text-white text-lg md:text-xl" />
              </motion.button>
            )}

            <motion.button
              onClick={leaveMeeting}
              className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title="Leave meeting"
            >
              <FontAwesomeIcon icon={faPhoneSlash as IconProp} className="text-white text-lg md:text-xl" />
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    const audioElement = audioRef.current;
    
    if (participant.stream) {
      console.log('Setting stream for participant, tracks:', participant.stream.getTracks().map(t => t.kind));
      const audioTracks = participant.stream.getAudioTracks();
      console.log('Audio tracks:', audioTracks.map(t => ({ enabled: t.enabled, muted: t.muted, readyState: t.readyState })));
      
      // CRITICAL: Ensure audio tracks are enabled
      audioTracks.forEach(track => {
        if (!track.enabled) {
          console.log('⚠️ Enabling disabled audio track');
          track.enabled = true;
        }
      });
      
      // Set video stream - video element should handle BOTH video and audio now
      if (videoElement && videoElement.srcObject !== participant.stream) {
        videoElement.srcObject = participant.stream;
        videoElement.muted = false;  // IMPORTANT: unmute to hear audio
        videoElement.volume = 1.0;
        
        videoElement.play()
          .then(() => console.log('✅ Video+audio playing for participant'))
          .catch(err => {
            console.log('Video+audio play error:', err.name);
            if (err.name === 'NotAllowedError') {
              const playOnClick = () => {
                videoElement.muted = false;
                videoElement.volume = 1.0;
                videoElement.play().catch(e => console.log('Retry failed:', e));
                document.removeEventListener('click', playOnClick);
              };
              document.addEventListener('click', playOnClick, { once: true });
            }
            // Retry after delay
            setTimeout(() => {
              videoElement.muted = false;
              videoElement.play().catch(e => console.log('Retry play failed:', e));
            }, 500);
          });
      }
      
      // ALSO set backup audio element for redundancy
      if (audioElement && audioElement.srcObject !== participant.stream) {
        audioElement.srcObject = participant.stream;
        audioElement.volume = 1.0;
        audioElement.muted = false;
        
        setTimeout(() => {
          audioElement.play()
            .then(() => console.log('✅ Backup audio playing'))
            .catch(err => console.log('Backup audio blocked:', err.name));
        }, 200);
      }
      
      // Web Audio API approach - most reliable for cross-browser audio
      try {
        // Clean up previous audio context
        if (audioSourceRef.current) {
          audioSourceRef.current.disconnect();
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
        
        // Create new audio context
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        
        // Resume audio context (required for autoplay policy)
        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            console.log('✅ AudioContext resumed');
          });
        }
        
        // Create source from stream and connect to speakers
        const source = audioContext.createMediaStreamSource(participant.stream);
        audioSourceRef.current = source;
        source.connect(audioContext.destination);
        console.log('✅ Web Audio API: Connected participant audio to speakers');
        
        // Add click handler to resume if suspended
        const resumeAudio = () => {
          if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
              console.log('✅ AudioContext resumed after interaction');
            });
          }
          document.removeEventListener('click', resumeAudio);
        };
        document.addEventListener('click', resumeAudio, { once: true });
        
      } catch (webAudioError) {
        console.log('Web Audio API error (fallback to regular audio):', webAudioError);
      }
    }
    
    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
      if (audioElement) {
        audioElement.srcObject = null;
      }
      // Cleanup audio context
      if (audioSourceRef.current) {
        try { audioSourceRef.current.disconnect(); } catch (e) { /* ignore */ }
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) { /* ignore */ }
      }
    };
  }, [participant.stream]);

  // Handle when stream tracks are added/updated
  useEffect(() => {
    const stream = participant.stream;
    if (!stream) return;

    const handleTrackAdded = (event: MediaStreamTrackEvent) => {
      console.log('Track added to remote stream:', event.track.kind);
      // Enable the track if it's audio
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
      }
      if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log('Play on track added:', e));
      }
      if (audioRef.current && audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(e => console.log('Audio play on track added:', e));
      }
    };

    stream.addEventListener('addtrack', handleTrackAdded);
    
    return () => {
      stream.removeEventListener('addtrack', handleTrackAdded);
    };
  }, [participant.stream]);


  return (
    <>
      {/* Video element handles BOTH video and audio */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`absolute inset-0 w-full h-full object-cover ${participant.isVideoOff ? 'hidden' : ''}`}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          video.muted = false;
          video.volume = 1.0;
          video.play().catch(err => console.log('Video+Audio onLoadedMetadata play:', err));
        }}
      />
      {/* Backup audio element in case video element doesn't play audio properly */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          audio.volume = 1.0;
          audio.muted = false;
          audio.play().catch(err => console.log('Backup audio play:', err));
        }}
      />
    </>
  );
};

export default GroupMeeting;
