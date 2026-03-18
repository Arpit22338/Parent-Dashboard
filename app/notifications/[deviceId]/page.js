'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../../context/SocketContext';

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `Today ${timeStr}`;
  if (diffDays === 1) return `Yesterday ${timeStr}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString() + ' ' + timeStr;
}

function getAppIcon(packageName) {
  // Map common apps to emojis
  const appIcons = {
    'com.whatsapp': '💬',
    'com.instagram.android': '📷',
    'com.facebook.katana': '👤',
    'com.facebook.orca': '💬',
    'com.snapchat.android': '👻',
    'com.twitter.android': '🐦',
    'com.google.android.youtube': '▶️',
    'com.spotify.music': '🎵',
    'com.tiktok': '🎵',
    'com.zhiliaoapp.musically': '🎵',
    'com.google.android.gm': '📧',
    'com.microsoft.office.outlook': '📧',
    'com.google.android.apps.messaging': '💬',
    'com.samsung.android.messaging': '💬',
    'com.android.mms': '💬',
    'com.discord': '🎮',
    'com.telegram.messenger': '✈️',
    'com.viber.voip': '📞',
    'org.thoughtcrime.securesms': '🔒',
  };
  
  return appIcons[packageName] || '📱';
}

function getAppName(packageName, appName) {
  if (appName && appName !== packageName) return appName;
  
  // Extract readable name from package
  const knownApps = {
    'com.whatsapp': 'WhatsApp',
    'com.instagram.android': 'Instagram',
    'com.facebook.katana': 'Facebook',
    'com.facebook.orca': 'Messenger',
    'com.snapchat.android': 'Snapchat',
    'com.twitter.android': 'Twitter/X',
    'com.google.android.youtube': 'YouTube',
    'com.spotify.music': 'Spotify',
    'com.tiktok': 'TikTok',
    'com.zhiliaoapp.musically': 'TikTok',
    'com.google.android.gm': 'Gmail',
    'com.microsoft.office.outlook': 'Outlook',
    'com.google.android.apps.messaging': 'Messages',
    'com.samsung.android.messaging': 'Messages',
    'com.discord': 'Discord',
    'com.telegram.messenger': 'Telegram',
  };
  
  return knownApps[packageName] || packageName?.split('.').pop() || 'Unknown';
}

export default function NotificationsPage() {
  const params = useParams();
  const router = useRouter();
  const { socket, emit, on, off, isConnected } = useSocket();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [childName, setChildName] = useState('');
  const [filter, setFilter] = useState('all'); // all, messages, social, other
  const [autoRefresh, setAutoRefresh] = useState(true);

  const deviceId = params.deviceId;

  const fetchNotifications = useCallback(() => {
    if (!socket || !isConnected) return;
    
    setLoading(true);
    emit('notifications-request', { 
      deviceId,
      days: 3, // Only fetch last 3 days
    });
  }, [socket, isConnected, deviceId, emit]);

  useEffect(() => {
    // Get device info
    const handleDeviceList = (devices) => {
      const device = devices.find(d => d.deviceId === deviceId);
      if (device) {
        setChildName(device.childName || 'Unknown');
      }
    };

    // Handle notifications response
    const handleNotificationsResponse = (data) => {
      console.log('Notifications received:', data);
      
      if (data.deviceId && data.deviceId !== deviceId) return;
      
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      
      const notifs = data.notifications || data.data || [];
      // Sort by timestamp, newest first
      notifs.sort((a, b) => new Date(b.timestamp || b.time) - new Date(a.timestamp || a.time));
      setNotifications(notifs);
      setLoading(false);
      setError(null);
    };

    // Handle real-time notification updates
    const handleNewNotification = (data) => {
      if (data.deviceId !== deviceId) return;
      
      // Add new notification to the top
      setNotifications(prev => {
        const newNotif = data.notification || data;
        // Check if already exists (by id or content+time)
        const exists = prev.some(n => 
          n.id === newNotif.id || 
          (n.title === newNotif.title && n.text === newNotif.text && n.timestamp === newNotif.timestamp)
        );
        if (exists) return prev;
        return [newNotif, ...prev];
      });
    };

    if (socket && isConnected) {
      on('device-list', handleDeviceList);
      on('notifications-response', handleNotificationsResponse);
      on('notification-update', handleNewNotification);
      on('new-notification', handleNewNotification);
      
      emit('device-list-request');
      fetchNotifications();
    }

    return () => {
      if (socket) {
        off('device-list', handleDeviceList);
        off('notifications-response', handleNotificationsResponse);
        off('notification-update', handleNewNotification);
        off('new-notification', handleNewNotification);
      }
    };
  }, [socket, isConnected, deviceId, on, off, emit, fetchNotifications]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, fetchNotifications]);

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    
    const pkg = notif.packageName || notif.package || '';
    const messageApps = ['whatsapp', 'messenger', 'telegram', 'messaging', 'sms', 'mms', 'signal'];
    const socialApps = ['instagram', 'facebook', 'twitter', 'snapchat', 'tiktok', 'youtube', 'discord'];
    
    const isMessage = messageApps.some(app => pkg.toLowerCase().includes(app));
    const isSocial = socialApps.some(app => pkg.toLowerCase().includes(app));
    
    if (filter === 'messages') return isMessage;
    if (filter === 'social') return isSocial;
    if (filter === 'other') return !isMessage && !isSocial;
    
    return true;
  });

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notif) => {
    const date = new Date(notif.timestamp || notif.time);
    const dateKey = date.toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(notif);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-dark-900/95 backdrop-blur border-b border-dark-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-xl font-bold">🔔 Notifications</h1>
                <p className="text-dark-400 text-sm">{childName}&apos;s device</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchNotifications}
                disabled={loading}
                className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                🔄
              </button>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-lg transition-colors ${
                  autoRefresh ? 'bg-green-600 hover:bg-green-700' : 'bg-dark-700 hover:bg-dark-600'
                }`}
                title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              >
                ⏱️
              </button>
            </div>
          </div>
          
          {/* Filter tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {[
              { key: 'all', label: '📋 All' },
              { key: 'messages', label: '💬 Messages' },
              { key: 'social', label: '📱 Social' },
              { key: 'other', label: '📦 Other' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  filter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Info banner */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 mb-6">
          <p className="text-dark-300 text-sm">
            📅 Showing notifications from the last <span className="text-white font-semibold">3 days</span>. 
            Older notifications are automatically deleted to save storage.
          </p>
        </div>

        {loading && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
            <p className="text-dark-400">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 text-lg mb-4">❌ {error}</p>
            <button
              onClick={fetchNotifications}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">🔕</p>
            <p className="text-dark-400 text-lg">No notifications found</p>
            <p className="text-dark-500 text-sm mt-2">
              {filter !== 'all' ? 'Try a different filter' : 'Notifications will appear here when received'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([dateKey, notifs]) => (
              <div key={dateKey}>
                <h2 className="text-dark-400 text-sm font-medium mb-3 sticky top-32 bg-dark-900 py-2">
                  {new Date(dateKey).toDateString() === new Date().toDateString() 
                    ? 'Today' 
                    : new Date(dateKey).toDateString() === new Date(Date.now() - 86400000).toDateString()
                    ? 'Yesterday'
                    : new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
                  }
                </h2>
                <div className="space-y-2">
                  {notifs.map((notif, index) => {
                    const pkg = notif.packageName || notif.package || '';
                    const title = notif.title || notif.sender || 'Notification';
                    const text = notif.text || notif.content || notif.message || '';
                    const appName = getAppName(pkg, notif.appName || notif.app);
                    const icon = getAppIcon(pkg);
                    const time = formatTimestamp(notif.timestamp || notif.time);
                    
                    return (
                      <div
                        key={notif.id || `${pkg}-${index}`}
                        className="bg-dark-800 rounded-xl p-4 border border-dark-700 hover:border-dark-600 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl flex-shrink-0">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-dark-400 bg-dark-700 px-2 py-0.5 rounded">
                                {appName}
                              </span>
                              <span className="text-xs text-dark-500">{time}</span>
                            </div>
                            <p className="font-medium text-white truncate">{title}</p>
                            {text && (
                              <p className="text-dark-300 text-sm mt-1 line-clamp-3">{text}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && notifications.length > 0 && (
          <div className="mt-8 pt-6 border-t border-dark-700">
            <p className="text-dark-500 text-sm text-center">
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
