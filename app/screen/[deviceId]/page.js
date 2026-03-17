'use client';

import { useParams } from 'next/navigation';
import { useSocket } from '@/context/SocketContext';
import WebRTCViewer from '@/components/WebRTCViewer';
import Link from 'next/link';

export default function ScreenPage() {
  const params = useParams();
  const { getDevice } = useSocket();
  
  const deviceId = params.deviceId;
  const device = getDevice(deviceId);

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
              🖥️ Screen - {device?.childName || 'Unknown'}
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

      <div className="flex-1 overflow-hidden">
        {device?.isOnline ? (
          <WebRTCViewer 
            deviceId={deviceId} 
            streamType="screen"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <div className="text-8xl mb-6 opacity-50">📵</div>
            <h2 className="text-xl font-semibold text-dark-300 mb-2">
              Device Offline
            </h2>
            <p className="text-dark-400 text-center mb-6">
              Screen sharing unavailable. The device is currently offline.
            </p>
            <Link
              href="/"
              className="px-6 py-3 bg-dark-700 hover:bg-dark-600 rounded-xl text-white transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
