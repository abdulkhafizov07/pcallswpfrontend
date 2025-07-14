'use client';

import { Card, Button } from '@chakra-ui/react';
import { useState, useEffect, useRef, useCallback } from 'react';

const STATUS_NAMES: Record<string, string> = {
  initializing: 'Initializing',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnecting: 'Disconnecting',
  disconnected: 'Disconnected',
  error: 'Error',
};

export function AudioChatComponent() {
  const [status, setStatus] = useState('initializing');
  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Reusable connect handler
  const connect = useCallback(async () => {
    // Disconnect old socket if exists
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close();
    }

    setStatus('connecting');

    // Setup new WebSocket
    const ws = new WebSocket(`ws://${window.location.hostname}:4531/vc`);
    socketRef.current = ws;

    ws.addEventListener('open', () => {
      setStatus('connected');
      console.log('✅ WebSocket connected');
    });

    ws.addEventListener('message', (message) => {
      console.log('📩 Message from server:', message.data);
    });

    ws.addEventListener('close', () => {
      setStatus('disconnected');
      console.log('🔌 WebSocket closed');
    });

    ws.addEventListener('error', () => {
      setStatus('error');
      console.error('❌ WebSocket error');
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(event.data);
        }
      };

      recorder.start(150); // send audio chunk every 150ms
    } catch (err) {
      console.error('🚫 Microphone access error:', err);
      setStatus('error');
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function') {
      connect();

      return () => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
        }

        if (socketRef.current) {
          socketRef.current.close();
        }
      };
    }
  }, [connect]);

  return (
    <>
      <Card.Root h="full" maxW="32rem">
        <Card.Body gap="2">
          <Card.Title mt="2">Audio Call</Card.Title>
          <Card.Description>Status: {STATUS_NAMES[status]}</Card.Description>
        </Card.Body>
        <Card.Footer>
          <Button onClick={connect}>Reconnect</Button>
        </Card.Footer>
      </Card.Root>
    </>
  );
}

