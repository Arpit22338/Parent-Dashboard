'use client';

import { useParams } from 'next/navigation';
import { useSocket } from '@/context/SocketContext';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function SnapshotPage() {
  const params = useParams();
  const { getDevice, emit, on, off } = useSocket();
  
  const deviceId = params.deviceId;
  const device = getDevice(deviceId);
  
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timestamp, setTimestamp] = useState(null);

  useEffect(() => {
    const handleSnapshot = (data) => {
      if (data.deviceId !== deviceId) return;
      
      setLoading(false);
      if (data.error) {
        setError(data.error);
        setSnapshot(null);
      } else {
        setSnapshot(data.image);
        setTimestamp(data.timestamp || new Date().toISOString());
        setError(null);
      }
    };

    on('snapshot-response', handleSnapshot);

    return () => {
      off('snapshot-response', handleSnapshot);
    };
  }, [deviceId, on, off]);

  const takeSnapshot = useCallback(() => {
    setLoading(true);
    setError(null);
    emit('snapshot-request', {
      targetDeviceId: deviceId,
    });
  }, [deviceId, emit]);

  const downloadSnapshot = useCallback(() => {
    if (!snapshot) return;
    
    const link = document.createElement('a');
    const imageData = snapshot.startsWith('data:') 
      ? snapshot 
      : `data:image/jpeg;base64,${snapshot}`;
    link.href = imageData;
    link.download = `snapshot-${device?.childName || 'device'}-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [snapshot, device]);

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  };

  return (
    <main className="h-screen flex flex-col bg-dark-900">
      <header className="bg-dark-800 border-b border-dark-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <span className="text-xl">←</span>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">
              📸 Snapshot - {device?.childName || 'Unknown'}
            </h1>
            <p className="text-xs text-dark-400">
              {device?.deviceModel || 'Device'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span 
            className={`w-2 h-2 rounded-full ${device?.isOnline ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-sm text-dark-300">
            {device?.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      {device?.isOnline ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-dark-300 text-lg">Capturing snapshot...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center">
                <div className="text-6xl mb-4">⚠️</div>
                <p className="text-red-400 text-center mb-4">{error}</p>
                <button
                  onClick={takeSnapshot}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-semibold transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : snapshot ? (
              <div className="flex flex-col items-center max-w-full max-h-full">
                <img
                  src={snapshot.startsWith('data:') ? snapshot : `data:image/jpeg;base64,${snapshot}`}
                  alt="Device snapshot"
                  className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl"
                />
                {timestamp && (
                  <p className="mt-4 text-dark-400 text-sm">
                    📅 Captured: {formatTimestamp(timestamp)}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="text-8xl mb-6 opacity-50">📷</div>
                <p className="text-dark-400 text-center mb-6">
                  Take a snapshot of the device camera
                </p>
              </div>
            )}
          </div>

          <div className="bg-dark-800 border-t border-dark-700 p-4">
            <div className="flex justify-center gap-4">
              <button
                onClick={takeSnapshot}
                disabled={loading}
                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center gap-2 ${
                  loading 
                    ? 'bg-dark-600 text-dark-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
                }`}
              >
                <span className="text-2xl">📸</span>
                {loading ? 'Capturing...' : 'Take Snapshot'}
              </button>
              
              {snapshot && !loading && (
                <button
                  onClick={downloadSnapshot}
                  className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-lg text-white transition-all hover:scale-105 flex items-center gap-2"
                >
                  <span className="text-2xl">💾</span>
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-8xl mb-6 opacity-50">📵</div>
          <h2 className="text-xl font-semibold text-dark-300 mb-2">
            Device Offline
          </h2>
          <p className="text-dark-400 text-center mb-6">
            Snapshot unavailable. The device is currently offline.
          </p>
          <Link
            href="/"
            className="px-6 py-3 bg-dark-700 hover:bg-dark-600 rounded-xl text-white transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      )}
    </main>
  );
}
