import React, { useEffect, useRef, useState } from "react";
import { Smartphone, WifiOff } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";

interface PhoneCameraFeedProps {
  sessionId: string;
}

const PhoneCameraFeed: React.FC<PhoneCameraFeedProps> = ({ sessionId }) => {
  const { wsBaseUrl } = useApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${wsBaseUrl}/ws/camera/${sessionId}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("Camera feed WebSocket connected");
          setIsConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          // Handle incoming video chunks
          if (event.data instanceof Blob) {
            handleVideoChunk(event.data);
          } else if (event.data === "camera_connected") {
            setIsConnected(true);
          }
        };

        ws.onclose = () => {
          console.log("Camera feed WebSocket disconnected");
          setIsConnected(false);
        };

        ws.onerror = (error) => {
          console.error("Camera feed WebSocket error:", error);
          setError("Failed to connect to camera feed");
          setIsConnected(false);
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setError("Failed to establish connection");
      }
    };

    const handleVideoChunk = (chunk: Blob) => {
      // For now, we'll just log that we received a chunk
      // In a full implementation, this would use MediaSource API
      console.log("Received video chunk:", chunk.size, "bytes");
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaSourceRef.current) {
        mediaSourceRef.current.endOfStream();
      }
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="w-full h-32 bg-gray-800 rounded-lg flex flex-col items-center justify-center">
        <WifiOff className="w-6 h-6 text-red-400 mb-2" />
        <p className="text-xs text-red-400 text-center">{error}</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="w-full h-32 bg-gray-800 rounded-lg flex flex-col items-center justify-center">
        <Smartphone className="w-6 h-6 text-gray-500 mb-2" />
        <p className="text-xs text-gray-500 text-center">
          Waiting for phone camera...
        </p>
        <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mt-2"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-32 bg-gray-800 rounded-lg overflow-hidden relative">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        muted
        playsInline
      />
      <div className="absolute top-2 left-2">
        <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400">LIVE</span>
        </div>
      </div>
      <div className="absolute bottom-2 right-2">
        <Smartphone className="w-4 h-4 text-white/70" />
      </div>
    </div>
  );
};

export default PhoneCameraFeed;
