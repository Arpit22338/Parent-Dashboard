'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const listenersRef = useRef({});

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const socketUrl = backendUrl.startsWith('http') ? backendUrl : `https://${backendUrl}`;
    
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
      socketInstance.emit('register-parent');
      socketInstance.emit('device-list-request');
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('device-list', (deviceList) => {
      console.log('Device list received:', deviceList);
      setDevices(deviceList || []);
    });

    socketInstance.on('location-update', (data) => {
      // Handle different data formats
      const deviceId = data.deviceId || data.from || data.fromDeviceId;
      const location = data.location || data.coords || data;
      
      if (!deviceId) return;
      
      setDevices(prev => prev.map(device => 
        device.deviceId === deviceId 
          ? { ...device, location }
          : device
      ));
    });

    socketInstance.on('battery-update', (data) => {
      // Handle different data formats
      const deviceId = data.deviceId || data.from || data.fromDeviceId;
      const battery = data.battery || data;
      
      if (!deviceId) return;
      
      setDevices(prev => prev.map(device => 
        device.deviceId === deviceId 
          ? { ...device, battery }
          : device
      ));
    });

    socketInstance.on('device-connected', (data) => {
      const device = data.device || data;
      
      setDevices(prev => {
        const exists = prev.find(d => d.deviceId === device.deviceId);
        if (exists) {
          return prev.map(d => d.deviceId === device.deviceId ? { ...device, isOnline: true } : d);
        }
        return [...prev, { ...device, isOnline: true }];
      });
    });

    socketInstance.on('device-disconnected', (data) => {
      const deviceId = data.deviceId || data;
      
      setDevices(prev => prev.map(device => 
        device.deviceId === deviceId 
          ? { ...device, isOnline: false, lastSeen: new Date().toISOString() }
          : device
      ));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socket) {
      socket.emit(event, data);
    }
  }, [socket]);

  const on = useCallback((event, callback) => {
    if (socket) {
      socket.on(event, callback);
      if (!listenersRef.current[event]) {
        listenersRef.current[event] = [];
      }
      listenersRef.current[event].push(callback);
    }
  }, [socket]);

  const off = useCallback((event, callback) => {
    if (socket) {
      socket.off(event, callback);
      if (listenersRef.current[event]) {
        listenersRef.current[event] = listenersRef.current[event].filter(cb => cb !== callback);
      }
    }
  }, [socket]);

  const getDevice = useCallback((deviceId) => {
    return devices.find(d => d.deviceId === deviceId);
  }, [devices]);

  const requestDeviceList = useCallback(() => {
    if (socket) {
      socket.emit('device-list-request');
    }
  }, [socket]);

  const value = {
    socket,
    isConnected,
    devices,
    emit,
    on,
    off,
    getDevice,
    requestDeviceList,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
