'use client';

import { Card, Button, Text, Heading } from '@chakra-ui/react';
import { useEffect, useRef, useState, useCallback } from 'react';

const STATUS_NAMES: Record<string, string> = {
  initializing: 'Initializing',
  connecting: 'Connecting',
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error',
};

const SIGNALING_SERVER = 'wss://api.pcalls.infinite-co.uz/ws/test-room'; // change room if needed
const STUN_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function AudioChatComponent() {
  const [status, setStatus] = useState('initializing');
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const setupWebRTC = useCallback(async () => {
    setStatus('connecting');

    // Create peer connection
    const peer = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionRef.current = peer;

    // Get audio stream
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = localStream;

    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
    });

    // Handle incoming audio from remote peer
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play().catch((err) => console.error('Audio play error', err));
    };

    // Setup signaling
    const socket = new WebSocket(SIGNALING_SERVER);
    socketRef.current = socket;

    socket.onopen = async () => {
      setStatus('connected');
      console.log('✅ WebSocket connected');

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ type: 'offer', data: offer }));
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'offer') {
        await peer.setRemoteDescription(new RTCSessionDescription(message.data));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: 'answer', data: answer }));
      }

      if (message.type === 'answer') {
        await peer.setRemoteDescription(new RTCSessionDescription(message.data));
      }

      if (message.type === 'ice') {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(message.data));
        } catch (e) {
          console.error('Invalid ICE candidate', e);
        }
      }
    };

    socket.onclose = () => {
      setStatus('disconnected');
    };

    socket.onerror = () => {
      setStatus('error');
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ice', data: event.candidate }));
      }
    };
  }, []);

  useEffect(() => {
    setupWebRTC();

    return () => {
      peerConnectionRef.current?.close();
      socketRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [setupWebRTC]);

  return (
    <Card.Root maxW="32rem" h="full">
      <Card.Body>
        <Heading size="md" mt={2}>Audio Chat</Heading>
        <Text>Status: {STATUS_NAMES[status]}</Text>
      </Card.Body>
      <Card.Footer>
        <Button onClick={setupWebRTC}>Reconnect</Button>
      </Card.Footer>
    </Card.Root>
  );
}
