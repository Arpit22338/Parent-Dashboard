'use client';

import { useSocket } from '@/context/SocketContext';
import DeviceCard from '@/components/DeviceCard';

export default function HomePage() {
  const { devices, isConnected } = useSocket();

  const onlineDevices = devices.filter(d => d.isOnline);
  const offlineDevices = devices.filter(d => !d.isOnline);
  const sortedDevices = [...onlineDevices, ...offlineDevices];

  return (
    <main className="min-h-screen bg-dark-900">
      <header className="bg-dark-800 border-b border-dark-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👨‍👩‍👧‍👦</span>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Family Monitor
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span 
                  className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span className="text-sm text-dark-300 hidden sm:inline">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="bg-dark-700 px-3 py-1.5 rounded-lg">
                <span className="text-dark-300 text-sm">
                  <span className="text-blue-400 font-semibold">{onlineDevices.length}</span>
                  <span className="mx-1">/</span>
                  <span>{devices.length}</span>
                  <span className="ml-1 hidden sm:inline">devices online</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-8xl mb-6 opacity-50">📱</div>
            <h2 className="text-2xl font-semibold text-dark-300 mb-2">
              No Devices Connected
            </h2>
            <p className="text-dark-400 text-center max-w-md">
              Install the companion app on your children's devices and they will appear here automatically.
            </p>
            {!isConnected && (
              <div className="mt-6 flex items-center gap-2 text-yellow-500">
                <span className="animate-spin">⟳</span>
                <span>Connecting to server...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedDevices.map((device, index) => (
              <DeviceCard 
                key={device.deviceId} 
                device={device} 
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
