import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(API_BASE_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
  }
  return socketInstance;
}

export function connectSocket() {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
  }
}
