import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useSocket(eventListeners: { [event: string]: (data: any) => void }) {
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef(eventListeners);

  // Keep listenersRef up-to-date with current handlers
  useEffect(() => {
    listenersRef.current = eventListeners;
  }, [eventListeners]);

  useEffect(() => {
    // Connect to NestJS websocket gateway
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    // Delegate incoming events to latest handlers
    for (const event of Object.keys(listenersRef.current)) {
      socket.on(event, (data) => {
        if (listenersRef.current[event]) {
          listenersRef.current[event](data);
        }
      });
    }

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}
export default useSocket;
