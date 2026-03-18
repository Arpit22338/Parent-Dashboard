'use client';

import Link from 'next/link';

const accentColors = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-emerald-500 to-emerald-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-cyan-500 to-cyan-600',
  'from-yellow-500 to-yellow-600',
  'from-red-500 to-red-600',
  'from-indigo-500 to-indigo-600',
  'from-teal-500 to-teal-600',
];

const accentBorders = [
  'border-blue-500',
  'border-purple-500',
  'border-emerald-500',
  'border-orange-500',
  'border-pink-500',
  'border-cyan-500',
  'border-yellow-500',
  'border-red-500',
  'border-indigo-500',
  'border-teal-500',
];

function getBatteryIcon(percentage, isCharging) {
  if (isCharging) return '🔌';
  if (percentage >= 80) return '🔋';
  if (percentage >= 50) return '🔋';
  if (percentage >= 20) return '🪫';
  return '🪫';
}

function getBatteryColor(percentage) {
  if (percentage >= 50) return 'text-green-400';
  if (percentage >= 20) return 'text-yellow-400';
  return 'text-red-400';
}

function formatLastSeen(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function normalizeBattery(battery) {
  if (!battery) return { percent: null, isCharging: false };
  
  // Get raw value from various possible fields
  let rawValue = battery.percentage ?? battery.level ?? battery.percent ?? battery.value ?? null;
  let isCharging = battery.isCharging ?? battery.charging ?? battery.plugged ?? false;
  
  if (rawValue === null || rawValue === undefined) {
    return { percent: null, isCharging };
  }
  
  // Convert to number
  rawValue = Number(rawValue);
  
  // If value is between 0 and 1, it's a decimal - multiply by 100
  if (rawValue > 0 && rawValue <= 1) {
    rawValue = Math.round(rawValue * 100);
  } else {
    rawValue = Math.round(rawValue);
  }
  
  // Clamp between 0 and 100
  rawValue = Math.max(0, Math.min(100, rawValue));
  
  return { percent: rawValue, isCharging };
}

function normalizeLocation(location) {
  if (!location) return null;
  
  const lat = location.latitude ?? location.lat ?? location.coords?.latitude ?? null;
  const lng = location.longitude ?? location.lng ?? location.lon ?? location.coords?.longitude ?? null;
  
  if (lat === null || lng === null || lat === 0 || lng === 0) {
    return null;
  }
  
  return { lat: Number(lat), lng: Number(lng) };
}

export default function DeviceCard({ device, index }) {
  const {
    deviceId,
    childName,
    deviceModel,
    isOnline,
    battery,
    location,
    lastSeen,
  } = device;

  const colorIndex = index % accentColors.length;
  const accentGradient = accentColors[colorIndex];
  const borderColor = accentBorders[colorIndex];

  const { percent: batteryPercent, isCharging } = normalizeBattery(battery);
  const normalizedLocation = normalizeLocation(location);

  return (
    <div 
      className={`bg-dark-800 rounded-2xl border-2 ${borderColor} overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30`}
    >
      <div className={`bg-gradient-to-r ${accentGradient} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white truncate">
            {childName || 'Unknown Child'}
          </h2>
          <div className="flex items-center gap-2">
            <span 
              className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}
            />
            <span className="text-white text-sm font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="text-dark-300 text-sm">
          📱 {deviceModel || 'Unknown Device'}
        </div>

        <div className="flex items-center justify-between">
          {batteryPercent !== null ? (
            <div className={`flex items-center gap-2 ${getBatteryColor(batteryPercent)}`}>
              <span className="text-xl">{getBatteryIcon(batteryPercent, isCharging)}</span>
              <span className="font-semibold text-lg">{batteryPercent}%</span>
              {isCharging && <span className="text-xs text-yellow-400">⚡ Charging</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-dark-500">
              <span className="text-xl">🔋</span>
              <span className="text-sm">Battery N/A</span>
            </div>
          )}
          
          {!isOnline && lastSeen && (
            <div className="text-dark-400 text-sm">
              Last seen: {formatLastSeen(lastSeen)}
            </div>
          )}
        </div>

        {normalizedLocation ? (
          <a
            href={`https://maps.google.com/?q=${normalizedLocation.lat},${normalizedLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>📍</span>
            <span className="text-sm underline">View Location on Maps</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 text-dark-500">
            <span>📍</span>
            <span className="text-sm">Location unavailable</span>
          </div>
        )}

        <div className="grid grid-cols-6 gap-2 pt-2">
          <Link
            href={`/camera/${deviceId}`}
            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200
              ${isOnline 
                ? 'bg-dark-700 hover:bg-dark-600 cursor-pointer' 
                : 'bg-dark-900 opacity-50 cursor-not-allowed pointer-events-none'
              }`}
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs text-dark-300 mt-1">Camera</span>
          </Link>

          <Link
            href={`/screen/${deviceId}`}
            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200
              ${isOnline 
                ? 'bg-dark-700 hover:bg-dark-600 cursor-pointer' 
                : 'bg-dark-900 opacity-50 cursor-not-allowed pointer-events-none'
              }`}
          >
            <span className="text-2xl">🖥️</span>
            <span className="text-xs text-dark-300 mt-1">Screen</span>
          </Link>

          <Link
            href={`/mic/${deviceId}`}
            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200
              ${isOnline 
                ? 'bg-dark-700 hover:bg-dark-600 cursor-pointer' 
                : 'bg-dark-900 opacity-50 cursor-not-allowed pointer-events-none'
              }`}
          >
            <span className="text-2xl">🎤</span>
            <span className="text-xs text-dark-300 mt-1">Mic</span>
          </Link>

          <Link
            href={`/files/${deviceId}`}
            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200
              ${isOnline 
                ? 'bg-dark-700 hover:bg-dark-600 cursor-pointer' 
                : 'bg-dark-900 opacity-50 cursor-not-allowed pointer-events-none'
              }`}
          >
            <span className="text-2xl">📁</span>
            <span className="text-xs text-dark-300 mt-1">Files</span>
          </Link>

          <Link
            href={`/snapshot/${deviceId}`}
            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200
              ${isOnline 
                ? 'bg-dark-700 hover:bg-dark-600 cursor-pointer' 
                : 'bg-dark-900 opacity-50 cursor-not-allowed pointer-events-none'
              }`}
          >
            <span className="text-2xl">📸</span>
            <span className="text-xs text-dark-300 mt-1">Snap</span>
          </Link>

          <Link
            href={`/notifications/${deviceId}`}
            className="flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 bg-dark-700 hover:bg-dark-600 cursor-pointer"
          >
            <span className="text-2xl">🔔</span>
            <span className="text-xs text-dark-300 mt-1">Notifs</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
