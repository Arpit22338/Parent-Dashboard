'use client';

import { useParams } from 'next/navigation';
import { useSocket } from '@/context/SocketContext';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(item) {
  if (item.isDirectory) return '📁';
  
  const ext = item.name?.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'webm'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
  
  if (imageExts.includes(ext)) return '🖼️';
  if (videoExts.includes(ext)) return '🎬';
  if (audioExts.includes(ext)) return '🎵';
  if (docExts.includes(ext)) return '📄';
  if (archiveExts.includes(ext)) return '📦';
  if (ext === 'apk') return '📲';
  
  return '📄';
}

export default function FilesPage() {
  const params = useParams();
  const { getDevice, emit, on, off } = useSocket();
  
  const deviceId = params.deviceId;
  const device = getDevice(deviceId);
  
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const requestFiles = useCallback((path) => {
    setLoading(true);
    setError(null);
    emit('file-list-request', {
      targetDeviceId: deviceId,
      path: path,
    });
  }, [deviceId, emit]);

  useEffect(() => {
    const handleFileList = (data) => {
      if (data.deviceId !== deviceId) return;
      
      setLoading(false);
      if (data.error) {
        setError(data.error);
        setFiles([]);
      } else {
        setFiles(data.files || []);
        if (data.path) {
          setCurrentPath(data.path);
        }
      }
    };

    on('file-list-response', handleFileList);
    requestFiles('/');

    return () => {
      off('file-list-response', handleFileList);
    };
  }, [deviceId, on, off, requestFiles]);

  const navigateTo = (path) => {
    setSelectedFile(null);
    requestFiles(path);
  };

  const goUp = () => {
    if (currentPath === '/') return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateTo(parentPath);
  };

  const handleItemClick = (item) => {
    if (item.isDirectory) {
      const newPath = currentPath === '/' 
        ? `/${item.name}` 
        : `${currentPath}/${item.name}`;
      navigateTo(newPath);
    } else {
      setSelectedFile(item);
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

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
              📁 Files - {device?.childName || 'Unknown'}
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
          <div className="bg-dark-800 border-b border-dark-700 px-4 py-2 flex items-center gap-2">
            <button
              onClick={goUp}
              disabled={currentPath === '/'}
              className={`p-2 rounded-lg transition-colors ${
                currentPath === '/' 
                  ? 'text-dark-500 cursor-not-allowed' 
                  : 'text-white hover:bg-dark-700'
              }`}
            >
              <span className="text-lg">⬆️</span>
            </button>
            <div className="flex-1 bg-dark-700 px-3 py-2 rounded-lg overflow-x-auto">
              <code className="text-sm text-dark-300 whitespace-nowrap">
                {currentPath}
              </code>
            </div>
            <button
              onClick={() => requestFiles(currentPath)}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-white"
            >
              <span className="text-lg">🔄</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-dark-400">Loading files...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full p-6">
                <div className="text-6xl mb-4">⚠️</div>
                <p className="text-red-400 text-center mb-4">{error}</p>
                <button
                  onClick={() => requestFiles(currentPath)}
                  className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : sortedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6">
                <div className="text-6xl mb-4 opacity-50">📂</div>
                <p className="text-dark-400">This folder is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-700">
                {sortedFiles.map((item, index) => (
                  <button
                    key={`${item.name}-${index}`}
                    onClick={() => handleItemClick(item)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-800 transition-colors text-left ${
                      selectedFile?.name === item.name ? 'bg-dark-700' : ''
                    }`}
                  >
                    <span className="text-2xl">{getFileIcon(item)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{item.name}</p>
                      {!item.isDirectory && item.size !== undefined && (
                        <p className="text-xs text-dark-400">
                          {formatFileSize(item.size)}
                        </p>
                      )}
                    </div>
                    {item.isDirectory && (
                      <span className="text-dark-400">→</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedFile && !selectedFile.isDirectory && (
            <div className="bg-dark-800 border-t border-dark-700 p-4">
              <div className="flex items-start gap-4">
                <span className="text-4xl">{getFileIcon(selectedFile)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{selectedFile.name}</p>
                  <div className="mt-1 space-y-1">
                    {selectedFile.size !== undefined && (
                      <p className="text-sm text-dark-400">
                        Size: {formatFileSize(selectedFile.size)}
                      </p>
                    )}
                    {selectedFile.type && (
                      <p className="text-sm text-dark-400">
                        Type: {selectedFile.type}
                      </p>
                    )}
                    {selectedFile.lastModified && (
                      <p className="text-sm text-dark-400">
                        Modified: {new Date(selectedFile.lastModified).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-8xl mb-6 opacity-50">📵</div>
          <h2 className="text-xl font-semibold text-dark-300 mb-2">
            Device Offline
          </h2>
          <p className="text-dark-400 text-center mb-6">
            File browser unavailable. The device is currently offline.
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
