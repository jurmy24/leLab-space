import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, WifiOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/contexts/ApiContext";

const PhoneCamera = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const { wsBaseUrl } = useApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      return;
    }

    connectWebSocket();
    return () => {
      cleanup();
    };
  }, [sessionId]);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`${wsBaseUrl}/ws/camera/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Phone camera WebSocket connected");
        setIsConnected(true);
        setError(null);
        // Notify the recording page that a camera is connected
        ws.send("camera_connected");
      };

      ws.onclose = () => {
        console.log("Phone camera WebSocket disconnected");
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error("Phone camera WebSocket error:", error);
        setError("Failed to connect to recording session");
        setIsConnected(false);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setError("Failed to establish connection");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      startVideoStreaming();
    } catch (error) {
      console.error("Error accessing camera:", error);
      setError("Could not access camera. Please check permissions.");
    }
  };

  const startVideoStreaming = () => {
    if (!videoRef.current || !canvasRef.current || !wsRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const ws = wsRef.current;

    const sendFrame = () => {
      if (!ctx || !isConnected || !isStreaming) return;

      // Draw video frame to canvas
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob and send via WebSocket
      canvas.toBlob(
        (blob) => {
          if (blob && ws.readyState === WebSocket.OPEN) {
            ws.send(blob);
          }
        },
        "image/jpeg",
        0.7
      );
    };

    // Send frames at ~10 FPS
    const interval = setInterval(sendFrame, 100);

    return () => clearInterval(interval);
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <WifiOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Session</h1>
          <p className="text-gray-400">No session ID provided in the URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 p-4 border-b border-gray-700">
        <div className="flex items-center justify-center">
          <h1 className="text-2xl font-bold">LeLab Camera</h1>
        </div>
      </div>

      {/* Camera Section */}
      <div className="flex-1 flex flex-col p-4">
        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <WifiOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Connection Error</h2>
              <p className="text-gray-400 mb-4">{error}</p>
              <Button
                onClick={connectWebSocket}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Retry Connection
              </Button>
            </div>
          </div>
        ) : !isConnected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-xl font-bold mb-2">Connecting...</h2>
              <p className="text-gray-400">Connecting to recording session</p>
            </div>
          </div>
        ) : !isStreaming ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Camera className="w-16 h-16 text-blue-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">Ready to Start</h2>
            <p className="text-gray-400 mb-6 text-center">
              Tap the button below to start your camera and begin streaming to
              the recording session.
            </p>
            <Button
              onClick={startCamera}
              className="bg-blue-500 hover:bg-blue-600 px-8 py-4 text-lg"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Camera
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-400 font-semibold">STREAMING</span>
              </div>
              <Smartphone className="w-5 h-5 text-blue-400" />
            </div>

            <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-4 text-center">
              <p className="text-gray-400 text-sm">
                Your camera is now streaming to the recording session. Keep this
                page open during recording.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhoneCamera;
