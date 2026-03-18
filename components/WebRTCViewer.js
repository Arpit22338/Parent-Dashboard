'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '@/context/SocketContext';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const CONNECTION_TIMEOUT = 30000; // 30 seconds timeout

export default function WebRTCViewer({ 
  deviceId, 
  streamType = 'camera', 
  audioOnly = false,
  onConnectionStateChange,
}) {
  const { socket, emit, on, off } = useSocket();
  const [connectionState, setConnectionState] = useState('connecting');
  const [error, setError] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('front');
  const [retryCount, setRetryCount] = useState(0);
  
  const peerConnectionRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const timeoutRef = useRef(null);
  const isCleaningUpRef = useRef(false);

  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    
    isCleaningUpRef.current = false;
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && !isCleaningUpRef.current) {
        console.log('Sending ICE candidate');
        emit('signal', {
          targetDeviceId: deviceId,
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Track received:', event.track.kind, event.streams);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (event.streams && event.streams[0]) {
        streamRef.current = event.streams[0];
        
        if (audioOnly) {
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
          }
        } else {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
        }
        
        setConnectionState('connected');
        onConnectionStateChange?.('connected');
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('Connection state:', state);
      
      if (isCleaningUpRef.current) return;
      
      if (state === 'connected') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setConnectionState('connected');
        onConnectionStateChange?.('connected');
      } else if (state === 'failed') {
        setError('Connection failed. The device may not support this feature or is busy.');
        setConnectionState('failed');
      } else if (state === 'disconnected') {
        setError('Connection lost. The device may have gone offline.');
        setConnectionState('disconnected');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        console.log('ICE connection failed, attempting restart');
        pc.restartIce();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', pc.iceGatheringState);
    };

    return pc;
  }, [deviceId, emit, audioOnly, onConnectionStateChange]);

  const handleSignal = useCallback(async (data) => {
    // Handle different signal formats from backend
    const fromDevice = data.fromDeviceId || data.deviceId || data.from;
    if (fromDevice !== deviceId) return;
    
    const pc = peerConnectionRef.current;
    if (!pc || isCleaningUpRef.current) return;

    try {
      const signalType = data.type || data.signalType;
      
      if (signalType === 'answer' || data.answer) {
        console.log('Received answer from device');
        const answer = data.answer || data.sdp || data;
        
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(
            typeof answer === 'string' ? { type: 'answer', sdp: answer } : answer
          ));
          console.log('Remote description set successfully');
        }
      } else if ((signalType === 'ice-candidate' || data.candidate) && data.candidate) {
        console.log('Received ICE candidate from device');
        const candidate = data.candidate;
        
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Queue the candidate if remote description isn't set yet
          console.log('Queueing ICE candidate - remote description not set yet');
        }
      }
    } catch (err) {
      console.error('Signal handling error:', err);
      // Don't set error for non-critical signal issues
      if (err.name !== 'InvalidStateError') {
        console.warn('Signal error (non-critical):', err.message);
      }
    }
  }, [deviceId]);

  const startCall = useCallback(async (facing = 'front') => {
    cleanup();
    setError(null);
    setConnectionState('connecting');

    // Set timeout for connection
    timeoutRef.current = setTimeout(() => {
      if (connectionState === 'connecting') {
        setError('Connection timed out. The device may be busy or not responding. Please try again.');
        setConnectionState('failed');
        cleanup();
      }
    }, CONNECTION_TIMEOUT);

    try {
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add transceivers for receiving media
      if (!audioOnly) {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: !audioOnly,
      });
      
      await pc.setLocalDescription(offer);
      console.log('Local description set, sending call request');

      emit('call-request', {
        targetDeviceId: deviceId,
        type: streamType,
        cameraFacing: facing,
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
      });

    } catch (err) {
      console.error('Start call error:', err);
      setError('Failed to start call: ' + err.message);
      setConnectionState('failed');
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [cleanup, createPeerConnection, deviceId, emit, streamType, audioOnly, connectionState]);

  const endCall = useCallback(() => {
    emit('call-end', { targetDeviceId: deviceId });
    cleanup();
    setConnectionState('disconnected');
  }, [cleanup, deviceId, emit]);

  const toggleCamera = useCallback(() => {
    const newFacing = cameraFacing === 'front' ? 'back' : 'front';
    setCameraFacing(newFacing);
    setRetryCount(0);
    startCall(newFacing);
  }, [cameraFacing, startCall]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    startCall(cameraFacing);
  }, [cameraFacing, startCall]);

  useEffect(() => {
    if (!socket) return;

    on('signal', handleSignal);
    startCall(cameraFacing);

    return () => {
      off('signal', handleSignal);
      endCall();
    };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full bg-dark-900 flex flex-col">
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-6xl mb-4">📵</div>
          <p className="text-red-400 text-lg text-center mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-semibold transition-colors"
            >
              Retry Connection {retryCount > 0 ? `(${retryCount})` : ''}
            </button>
          </div>
          <p className="text-dark-500 text-sm mt-4 text-center max-w-md">
            Make sure the device has accepted the camera/screen permission request.
          </p>
        </div>
      ) : (
        <>
          {!audioOnly && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              className="flex-1 w-full object-contain bg-black"
            />
          )}
          
          {audioOnly && (
            <>
              <audio ref={audioRef} autoPlay />
              <AudioVisualizer stream={streamRef.current} connectionState={connectionState} />
            </>
          )}

          {connectionState === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-dark-300">Connecting to device...</p>
                <p className="text-dark-500 text-sm mt-2">Waiting for device to accept...</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
            {streamType === 'camera' && !audioOnly && (
              <button
                onClick={toggleCamera}
                disabled={connectionState === 'connecting'}
                className={`p-4 rounded-full text-white transition-colors backdrop-blur-sm ${
                  connectionState === 'connecting'
                    ? 'bg-dark-800/50 cursor-not-allowed'
                    : 'bg-dark-700/80 hover:bg-dark-600'
                }`}
                title="Switch Camera"
              >
                <span className="text-2xl">🔄</span>
              </button>
            )}
            
            <button
              onClick={endCall}
              className="p-4 bg-red-600 hover:bg-red-700 rounded-full text-white transition-colors"
              title="End Call"
            >
              <span className="text-2xl">📴</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AudioVisualizer({ stream, connectionState }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    if (!stream || connectionState !== 'connected') {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#202123';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#202123';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#8b5cf6');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [stream, connectionState]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="text-6xl mb-6">🎤</div>
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className="rounded-xl bg-dark-800"
      />
      <p className="text-dark-300 mt-4">
        {connectionState === 'connected' ? 'Listening...' : 'Connecting...'}
      </p>
    </div>
  );
}
