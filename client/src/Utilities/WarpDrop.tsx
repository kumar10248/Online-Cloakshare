import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faCopy, faTimes, faFile, faServer, faRocket, faExchangeAlt, faSpinner, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-hot-toast';
import { sounds } from '../utils/soundEffects';
import { baseURL } from '../Config';
import './WarpDrop.css';

interface WarpDropProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHUNK_SIZE = 64 * 1024; // 64 KB

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const WarpDrop: React.FC<WarpDropProps> = ({ isOpen, onClose }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [step, setStep] = useState<'initial' | 'waiting' | 'connecting' | 'connected' | 'transferring' | 'done'>('initial');
  const [roomId, setRoomId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  // Transfer state
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');
  const [incomingFileInfo, setIncomingFileInfo] = useState<{ name: string; size: number; type: string } | null>(null);
  const incomingFileInfoRef = useRef<{ name: string; size: number; type: string } | null>(null);
  const receivedBufferRef = useRef<ArrayBuffer[]>([]);

  // Refs for WebRTC
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const fileReaderRef = useRef<FileReader | null>(null);
  
  // Refs for tracking progress speed
  const totalBytesRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastBytesRef = useRef<number>(0);
  
  // Track role to prevent double-initialization
  const roleRef = useRef<'host'|'guest'>('guest');

  // Setup socket when opened
  useEffect(() => {
    if (isOpen) {
      const socketURL = baseURL || 'http://localhost:8000';
      const newSocket = io(socketURL, {
        transports: ['websocket', 'polling'],
      });
      setSocket(newSocket);

      newSocket.on('connect', () => console.log('WarpDrop connected to signaling server'));

      newSocket.on('room-created', (data: { roomId: string }) => {
        setRoomId(data.roomId);
        setStep('waiting');
      });

      newSocket.on('user-joined', () => {
        if (roleRef.current === 'guest') return;
        sounds.playChime();
        toast.success('Peer joined, connecting...');
        setStep('connecting');
        initiateWebRTC(newSocket, true);
      });

      newSocket.on('room-joined', (data: { roomId: string }) => {
        setRoomId(data.roomId);
        setStep('connecting');
        sounds.playChime();
        toast.success('Joined room, connecting...');
        // Host initiates WebRTC, so guest just waits for offer
        initiateWebRTC(newSocket, false);
      });

      newSocket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit }) => {
        if (!pcRef.current) return;
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          newSocket.emit('webrtc-answer', { roomId, answer });
        } catch (e) {
          console.error('Error handling offer', e);
        }
      });

      newSocket.on('webrtc-answer', async (data: { answer: RTCSessionDescriptionInit }) => {
        if (!pcRef.current) return;
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
          console.error('Error handling answer', e);
        }
      });

      newSocket.on('webrtc-ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
        if (!pcRef.current) return;
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      });

      newSocket.on('user-left', () => {
        toast.error('Peer disconnected');
        cleanupWebRTC();
        setStep('initial');
      });

      newSocket.on('error', (err: { message: string }) => {
        toast.error(err.message);
      });

      return () => {
        cleanupWebRTC();
        newSocket.disconnect();
      };
    }
  }, [isOpen]);

  const initiateWebRTC = (socketIns: Socket, isInitiator: boolean) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketIns.emit('webrtc-ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    if (isInitiator) {
      const dc = pc.createDataChannel('warp-drop');
      dcRef.current = dc;
      setupDataChannel(dc, isInitiator);

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketIns.emit('webrtc-offer', { roomId, offer: pc.localDescription });
        })
        .catch(e => console.error(e));
    } else {
      pc.ondatachannel = (event) => {
        dcRef.current = event.channel;
        setupDataChannel(event.channel, isInitiator);
      };
    }
  };

  const setupDataChannel = (dc: RTCDataChannel, isInitiator: boolean) => {
    dc.binaryType = 'arraybuffer';
    
    dc.onopen = () => {
      console.log('Data channel opened!');
      
      if (isInitiator) {
        toast.success('Connection established! You can now send a file.');
      }
      setStep('connected');
    };

    dc.onclose = () => {
      console.log('Data channel closed!');
      cleanupWebRTC();
      setStep('initial');
    };

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-meta') {
          setIncomingFileInfo(msg.meta);
          incomingFileInfoRef.current = msg.meta;
          receivedBufferRef.current = []; // Clear buffer for new file
          totalBytesRef.current = 0;
          setStep('transferring');
          startTimeRef.current = Date.now();
          lastTimeRef.current = Date.now();
          lastBytesRef.current = 0;
        } else if (msg.type === 'transfer-complete') {
          setStep('done');
          sounds.playPop();
          toast.success('File received successfully!');
        }
      } else if (event.data instanceof ArrayBuffer) {
        receivedBufferRef.current.push(event.data);
        
        const newBytes = totalBytesRef.current + event.data.byteLength;
        totalBytesRef.current = newBytes;
        
        // Calculate speed and progress
        const now = Date.now();
        if (now - lastTimeRef.current > 1000) {
          const diffBytes = newBytes - lastBytesRef.current;
          const speed = (diffBytes / 1024 / 1024) / ((now - lastTimeRef.current) / 1000);
          setTransferSpeed(`${speed.toFixed(1)} MB/s`);
          lastTimeRef.current = now;
          lastBytesRef.current = newBytes;
        }
        
        if (incomingFileInfoRef.current) {
          setTransferProgress(Math.floor((newBytes / incomingFileInfoRef.current.size) * 100));
        }
      }
    };
  };

  const handleDownload = () => {
    if (incomingFileInfo && receivedBufferRef.current.length > 0) {
      const blob = new Blob(receivedBufferRef.current, { type: incomingFileInfo.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = incomingFileInfo.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    if (step === 'done') {
      handleDownload();
    }
  }, [step]);

  const sendFile = () => {
    if (!file || !dcRef.current || dcRef.current.readyState !== 'open') return;
    
    sounds.playWhoosh();
    setStep('transferring');
    setTransferProgress(0);
    setTransferSpeed('Calculating...');
    
    // Send meta
    dcRef.current.send(JSON.stringify({
      type: 'file-meta',
      meta: { name: file.name, size: file.size, type: file.type }
    }));

    startTimeRef.current = Date.now();
    lastTimeRef.current = Date.now();
    lastBytesRef.current = 0;

    let offset = 0;
    const reader = new FileReader();
    fileReaderRef.current = reader;

    reader.onerror = error => console.error('Error reading file:', error);
    reader.onabort = () => console.log('File reading aborted.');
    
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        if (!dcRef.current) return;
        
        // Wait for buffer to clear if too full
        if (dcRef.current.bufferedAmount > dcRef.current.bufferedAmountLowThreshold) {
          const onBufferedAmountLow = () => {
            if (dcRef.current) {
              dcRef.current.removeEventListener('bufferedamountlow', onBufferedAmountLow);
              dcRef.current.send(e.target!.result as ArrayBuffer);
              offset += (e.target!.result as ArrayBuffer).byteLength;
              updateProgress(offset, file.size);
              readSlice(offset);
            }
          };
          dcRef.current.addEventListener('bufferedamountlow', onBufferedAmountLow);
        } else {
          dcRef.current.send(e.target.result);
          offset += e.target.result.byteLength;
          updateProgress(offset, file.size);
          readSlice(offset);
        }
      }
    };

    const readSlice = (o: number) => {
      if (o >= file.size) {
        dcRef.current?.send(JSON.stringify({ type: 'transfer-complete' }));
        setStep('done');
        toast.success('File sent successfully!');
        return;
      }
      const slice = file.slice(o, o + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    // Configure bufferedAmountLowThreshold
    dcRef.current.bufferedAmountLowThreshold = 65535;
    
    // Start reading
    readSlice(0);
  };

  const updateProgress = (sentBytes: number, totalSize: number) => {
    setTransferProgress(Math.floor((sentBytes / totalSize) * 100));
    const now = Date.now();
    if (now - lastTimeRef.current > 1000) {
      const diffBytes = sentBytes - lastBytesRef.current;
      const speed = (diffBytes / 1024 / 1024) / ((now - lastTimeRef.current) / 1000);
      setTransferSpeed(`${speed.toFixed(1)} MB/s`);
      lastTimeRef.current = now;
      lastBytesRef.current = sentBytes;
    }
  };

  const cleanupWebRTC = () => {
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  const handleCreateRoom = () => {
    if (socket) {
      roleRef.current = 'host';
      socket.emit('create-room', { userName: 'WarpSender' });
    }
  };

  const handleJoinRoom = () => {
    if (socket && joinCode) {
      roleRef.current = 'guest';
      // Use existing socket backend format
      socket.emit('join-room', { roomId: joinCode.trim(), userName: 'WarpReceiver' });
    } else {
      toast.error('Enter a valid room code');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Code copied!');
  };

  const closeWarpDrop = () => {
    if (step === 'transferring') {
      if (window.confirm("A transfer is in progress. Are you sure you want to exit?")) {
        cleanupWebRTC();
        socket?.disconnect();
        onClose();
      }
    } else {
      cleanupWebRTC();
      socket?.disconnect();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="warp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeWarpDrop}
        >
          <motion.div
            className="warp-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="warp-header">
              <div className="flex items-center space-x-3">
                <div className="warp-icon-badge">
                  <FontAwesomeIcon icon={faRocket as IconProp} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Warp Drop</h2>
                  <p className="text-slate-400 text-xs mt-0.5">P2P Unlimited File Sharing</p>
                </div>
              </div>
              <button onClick={closeWarpDrop} className="warp-close-btn">
                <FontAwesomeIcon icon={faTimes as IconProp} />
              </button>
            </div>

            <div className="warp-body">
              {step === 'initial' && (
                <div className="warp-initial">
                  <div className="warp-action-card">
                    <div className="warp-action-icon bg-violet-500/10 text-violet-400">
                      <FontAwesomeIcon icon={faServer as IconProp} />
                    </div>
                    <h3 className="text-white font-medium mb-2">Send File</h3>
                    <p className="text-slate-400 text-sm mb-4 text-center">Create a room and share the code to send files of any size.</p>
                    <button onClick={handleCreateRoom} className="warp-primary-btn bg-violet">
                      Create Warp Room
                    </button>
                  </div>
                  
                  <div className="warp-divider">
                    <span>OR</span>
                  </div>

                  <div className="warp-action-card">
                    <div className="warp-action-icon bg-cyan-500/10 text-cyan-400">
                      <FontAwesomeIcon icon={faExchangeAlt as IconProp} />
                    </div>
                    <h3 className="text-white font-medium mb-2">Receive File</h3>
                    <p className="text-slate-400 text-sm mb-4 text-center">Enter a code from the sender to connect instantly.</p>
                    <div className="flex space-x-2 w-full">
                      <input 
                        type="text" 
                        placeholder="4-digit code" 
                        className="warp-input flex-1 uppercase text-center tracking-widest font-mono"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        maxLength={4}
                      />
                      <button onClick={handleJoinRoom} className="warp-primary-btn bg-cyan px-6">
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(step === 'waiting' || step === 'connecting') && (
                <div className="warp-waiting text-center py-8">
                  <div className="inline-block relative">
                    <div className="w-24 h-24 rounded-full border-4 border-violet-500/30 flex items-center justify-center">
                      <FontAwesomeIcon icon={faSpinner as IconProp} className="text-violet-400 text-3xl animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" style={{ animationDuration: '2s' }}></div>
                  </div>
                  <h3 className="text-white text-lg font-medium mt-6 mb-2">
                    {step === 'waiting' ? 'Waiting for receiver...' : 'Establishing secure link...'}
                  </h3>
                  <p className="text-slate-400 text-sm mb-6">
                    {step === 'waiting' 
                      ? 'Share this code with the person you want to send files to.' 
                      : 'Connecting directly to peer via WebRTC...'}
                  </p>
                  
                  {step === 'waiting' && (
                    <div className="warp-code-box" onClick={copyCode}>
                      <span className="text-3xl tracking-widest font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                        {roomId}
                      </span>
                      <FontAwesomeIcon icon={faCopy as IconProp} className="text-slate-500 ml-4 hover:text-white transition-colors" />
                    </div>
                  )}
                </div>
              )}

              {step === 'connected' && (
                <div className="warp-connected">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center justify-center mb-6">
                    <FontAwesomeIcon icon={faCheckCircle as IconProp} className="mr-2" />
                    Secure peer-to-peer connection established
                  </div>

                  <div className="warp-file-selector border-2 border-dashed border-violet-500/30 rounded-xl p-8 text-center bg-violet-500/5 hover:bg-violet-500/10 transition-colors cursor-pointer" onClick={() => document.getElementById('warp-file')?.click()}>
                    <input type="file" id="warp-file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <FontAwesomeIcon icon={faFile as IconProp} className="text-4xl text-violet-400 mb-4" />
                    {file ? (
                      <div>
                        <h4 className="text-white font-medium mb-1">{file.name}</h4>
                        <p className="text-slate-400 text-sm">{formatSize(file.size)}</p>
                      </div>
                    ) : (
                      <p className="text-slate-400">Click to select a file to send</p>
                    )}
                  </div>
                  
                  {file && (
                    <button onClick={sendFile} className="warp-primary-btn bg-violet mt-6 w-full shimmer-btn">
                      <FontAwesomeIcon icon={faRocket as IconProp} className="mr-2" />
                      Send File
                    </button>
                  )}
                  
                  <p className="text-center text-slate-500 text-xs mt-4">
                    Or wait here if the other person is sending a file.
                  </p>
                </div>
              )}

              {step === 'transferring' && (
                <div className="warp-transferring py-6">
                  <div className="text-center mb-8">
                    <FontAwesomeIcon icon={faExchangeAlt as IconProp} className="text-4xl text-cyan-400 mb-4 animate-bounce" />
                    <h3 className="text-white text-lg font-medium">Transferring File</h3>
                    <p className="text-slate-400 text-sm">{incomingFileInfo ? incomingFileInfo.name : file?.name}</p>
                  </div>

                  <div className="warp-progress-container mb-4">
                    <div className="warp-progress-bar" style={{ width: `${transferProgress}%` }}>
                      <div className="warp-progress-glow"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-slate-400 text-sm font-mono">
                    <span>{transferProgress}%</span>
                    <span>{transferSpeed}</span>
                  </div>
                  
                  <p className="text-center text-slate-500 text-xs mt-8 italic">
                    Please do not close this window until the transfer is complete.
                  </p>
                </div>
              )}

              {step === 'done' && (
                <div className="warp-done text-center py-8">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 mb-6">
                    <FontAwesomeIcon icon={faCheckCircle as IconProp} className="text-5xl" />
                  </div>
                  <h3 className="text-white text-xl font-bold mb-2">Transfer Complete!</h3>
                  <p className="text-slate-400 mb-8">The file was successfully transferred directly via peer-to-peer connection.</p>
                  
                  {roleRef.current === 'guest' && (
                    <button onClick={handleDownload} className="warp-primary-btn bg-emerald-600 hover:bg-emerald-500 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      <FontAwesomeIcon icon={faFile as IconProp} className="mr-2" />
                      Save File Manually
                    </button>
                  )}
                  
                  <button onClick={() => setStep('connected')} className="warp-primary-btn bg-violet mt-2">
                    <FontAwesomeIcon icon={faExchangeAlt as IconProp} className="mr-2" />
                    Send Another File
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WarpDrop;
