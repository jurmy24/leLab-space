import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Video,
  VideoOff,
  Smartphone,
  Wifi,
  WifiOff,
  Camera,
  Settings,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import io from "socket.io-client";

const RemoteCamera: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const webrtcId = searchParams.get("webrtcId");
  const { toast } = useToast();

  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [framesSent, setFramesSent] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState<number>(0);
  const [fps, setFps] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug info
  const [debugInfo, setDebugInfo] = useState({
    sessionId: sessionId || "N/A",
    webrtcId: webrtcId || "N/A",
    serverUrl: "",
    userAgent: navigator.userAgent,
  });

  useEffect(() => {
    if (!sessionId || !webrtcId) {
      setError("Missing session ID or WebRTC ID in URL");
      return;
    }

    connectToServer();

    return () => {
      cleanup();
    };
  }, [sessionId, webrtcId]);

  // Update FPS calculation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (lastFrameTime > 0) {
        const timeDiff = (now - lastFrameTime) / 1000;
        if (timeDiff > 0) {
          setFps(Math.round(framesSent / timeDiff));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [framesSent, lastFrameTime]);

  const connectToServer = async () => {
    if (!sessionId || !webrtcId) {
      setError("Missing session ID or WebRTC ID");
      return;
    }

    try {
      setConnectionStatus("connecting");
      setError(null);

      // Force HTTP with polling to avoid mixed content issues
      // Polling transport works even when frontend is HTTPS and backend is HTTP
      const hostname = window.location.hostname;
      const serverUrl = `http://${hostname}:8000`;

      setDebugInfo((prev) => ({ ...prev, serverUrl }));

      console.log("📱 Connecting to WebRTC server:", serverUrl);

      socketRef.current = io(serverUrl, {
        transports: ["polling"], // Polling only to avoid WebSocket mixed content blocking
        timeout: 15000,
        forceNew: true,
        upgrade: false, // Prevent upgrade to WebSocket
      });

      // Set up the main event handlers
      setupSocketHandlers();
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to connect to server");
      setConnectionStatus("error");
    }
  };

  const setupSocketHandlers = () => {
    if (!socketRef.current) return;

    socketRef.current.on("connect", () => {
      console.log("📱 Connected to WebRTC server");
      setIsConnected(true);
      setConnectionStatus("connected");

      // Update debug info with successful URL
      const actualUrl = socketRef.current?.io?.uri || "unknown";
      setDebugInfo((prev) => ({
        ...prev,
        serverUrl: `${actualUrl} (connected)`,
      }));

      // Join the session
      socketRef.current?.emit("join_session", { webrtcId });

      toast({
        title: "Connected",
        description: "Successfully connected to the camera system",
      });
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("📱 Disconnected from WebRTC server:", reason);
      setIsConnected(false);
      setConnectionStatus("disconnected");

      toast({
        title: "Disconnected",
        description: `Connection lost: ${reason}`,
        variant: "destructive",
      });
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("📱 Connection error:", error);
      setConnectionStatus("error");
      setError(`Connection failed: ${error.message}`);

      toast({
        title: "Connection Error",
        description: `Could not connect to server: ${error.message}`,
        variant: "destructive",
      });
    });

    socketRef.current.on("session-joined", (data: { webrtcId: string }) => {
      console.log("📱 Joined session:", data);
      toast({
        title: "Session Joined",
        description: "Ready to start camera stream",
      });
    });

    socketRef.current.on("session-error", (data: { error: string }) => {
      console.error("❌ Session error:", data);
      setError(data.error);
      setConnectionStatus("error");
      toast({
        title: "Session Error",
        description: data.error,
        variant: "destructive",
      });
    });
  };

  const startStream = async () => {
    try {
      setError(null);
      console.log("📷 Requesting camera access...");

      // Request camera permission with mobile-optimized settings
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640, max: 1920 },
          height: { ideal: 720, min: 480, max: 1080 },
          frameRate: { ideal: 30, min: 15, max: 60 },
          facingMode: "environment", // Use back camera on mobile
        },
        audio: false,
      });

      console.log("📷 Camera access granted");
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      // Notify server that stream is ready
      if (socketRef.current && isConnected) {
        const videoTrack = mediaStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        socketRef.current.emit("stream_ready", {
          webrtcId,
          metadata: {
            width: settings.width || 1280,
            height: settings.height || 720,
            fps: settings.frameRate || 30,
            codec: "h264",
            deviceId: settings.deviceId,
            facingMode: settings.facingMode,
          },
        });

        console.log("📷 Stream metadata sent:", settings);
      }

      setIsStreaming(true);
      setFramesSent(0);
      setLastFrameTime(Date.now());

      toast({
        title: "Camera Started",
        description: "Your phone camera is now streaming",
      });

      // Start frame capture
      startFrameCapture(mediaStream);
    } catch (err: unknown) {
      console.error("Error starting camera:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);

      // Provide more helpful error messages
      let userMessage = "Could not access your phone's camera";
      if (errorMessage.includes("Permission denied")) {
        userMessage =
          "Camera permission denied. Please allow camera access and try again.";
      } else if (errorMessage.includes("NotFound")) {
        userMessage = "No camera found on this device.";
      } else if (errorMessage.includes("NotSupported")) {
        userMessage = "Camera not supported on this device.";
      }

      toast({
        title: "Camera Error",
        description: userMessage,
        variant: "destructive",
      });
    }
  };

  const stopStream = () => {
    console.log("📷 Stopping camera stream...");

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("📷 Stopped track:", track.kind);
      });
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setFramesSent(0);
    setFps(0);

    toast({
      title: "Camera Stopped",
      description: "Phone camera stream has been stopped",
    });
  };

  const startFrameCapture = (mediaStream: MediaStream) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const video = videoRef.current;

    if (!video || !ctx) {
      console.error("❌ Video element or canvas context not available");
      return;
    }

    console.log("📹 Starting frame capture...");

    const sendFrame = () => {
      if (
        !isStreaming ||
        !socketRef.current ||
        !isConnected ||
        !video.videoWidth
      ) {
        return;
      }

      try {
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to JPEG with compression
        const frameData = canvas.toDataURL("image/jpeg", 0.6);

        // Send frame to server
        socketRef.current?.emit("stream_data", {
          webrtcId,
          frameData,
          timestamp: Date.now(),
          sequence: framesSent,
          metadata: {
            width: canvas.width,
            height: canvas.height,
          },
        });

        setFramesSent((prev) => prev + 1);
        setLastFrameTime(Date.now());
      } catch (err) {
        console.error("Error capturing frame:", err);
      }
    };

    // Start sending frames at 10 FPS to avoid overwhelming connection
    frameIntervalRef.current = setInterval(sendFrame, 100);
    console.log("📹 Frame capture started at 10 FPS");
  };

  const cleanup = () => {
    console.log("🧹 Cleaning up...");
    stopStream();

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Wifi className="w-5 h-5 text-green-400" />;
      case "connecting":
        return <Wifi className="w-5 h-5 text-yellow-400 animate-pulse" />;
      case "error":
        return <WifiOff className="w-5 h-5 text-red-400" />;
      default:
        return <WifiOff className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  if (!sessionId || !webrtcId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Camera className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Invalid URL</h1>
          <p className="text-gray-400">
            Missing session ID or WebRTC ID in URL
          </p>
          <p className="text-gray-500 text-sm mt-2">
            URL should be:
            /remote_cam/&lt;session_id&gt;?webrtcId=&lt;webrtc_id&gt;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Smartphone className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-lg font-semibold text-white">
                Remote Camera
              </h1>
              <p className="text-sm text-gray-400">
                Session: {sessionId?.substring(0, 8)}...
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm text-gray-300">{getStatusText()}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Video Preview */}
        <div className="flex-1 bg-black relative min-h-[50vh]">
          {isStreaming ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onLoadedMetadata={() => console.log("📷 Video metadata loaded")}
              onError={(e) => console.error("📷 Video error:", e)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center p-6">
                <Camera className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">Camera Ready</p>
                <p className="text-gray-500 text-sm">
                  Tap "Start Camera" to begin streaming
                </p>
              </div>
            </div>
          )}

          {/* Streaming Indicator */}
          {isStreaming && (
            <div className="absolute top-4 left-4">
              <div className="flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">LIVE</span>
              </div>
            </div>
          )}

          {/* Stats Overlay */}
          {isStreaming && (
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-xs">
              <div>FPS: {fps}</div>
              <div>Frames: {framesSent}</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-6">
          {error && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm font-medium mb-1">Error:</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-center space-x-4 mb-4">
            {!isStreaming ? (
              <Button
                onClick={startStream}
                disabled={!isConnected}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg flex-1 max-w-xs"
              >
                <Video className="w-5 h-5 mr-2" />
                Start Camera
              </Button>
            ) : (
              <Button
                onClick={stopStream}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg flex-1 max-w-xs"
              >
                <VideoOff className="w-5 h-5 mr-2" />
                Stop Camera
              </Button>
            )}

            {!isConnected && (
              <Button
                onClick={connectToServer}
                disabled={connectionStatus === "connecting"}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700 px-6 py-3"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reconnect
              </Button>
            )}
          </div>

          {/* Debug Information */}
          <details className="mt-4">
            <summary className="text-gray-400 text-sm cursor-pointer hover:text-gray-300">
              <Settings className="w-4 h-4 inline mr-1" />
              Debug Info
            </summary>
            <div className="mt-2 bg-gray-900 p-3 rounded text-xs text-gray-400 space-y-1">
              <div>
                <strong>Session ID:</strong> {debugInfo.sessionId}
              </div>
              <div>
                <strong>WebRTC ID:</strong> {debugInfo.webrtcId}
              </div>
              <div>
                <strong>Server URL:</strong> {debugInfo.serverUrl}
              </div>
              <div>
                <strong>Status:</strong> {connectionStatus}
              </div>
              <div>
                <strong>Streaming:</strong> {isStreaming ? "Yes" : "No"}
              </div>
              {stream && (
                <div>
                  <strong>Stream Active:</strong> {stream.active ? "Yes" : "No"}
                </div>
              )}
              <div>
                <strong>User Agent:</strong> {debugInfo.userAgent}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default RemoteCamera;
