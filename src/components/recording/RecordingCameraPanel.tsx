import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Camera, 
  VideoOff, 
  Wifi, 
  WifiOff,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { webRTCManager } from "@/utils/webrtc/WebRTCManager";
import { UnifiedCameraSource } from "@/types/webrtc";
import { useApi } from "@/contexts/ApiContext";

interface RecordingCameraPanelProps {
  className?: string;
}

const RecordingCameraPanel: React.FC<RecordingCameraPanelProps> = ({
  className,
}) => {
  const { baseUrl } = useApi();
  const [webrtcSources, setWebrtcSources] = useState<UnifiedCameraSource[]>([]);
  const [isConnectedToSignaling, setIsConnectedToSignaling] = useState(false);
  
  // Video element refs for WebRTC streams
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // WebRTC event handlers (with useCallback to maintain references)
  const handleCameraAdded = useCallback((source: UnifiedCameraSource) => {
    console.log("📹 Camera added in recording:", source.name);
    setWebrtcSources(prev => {
      // Remove any existing source with same ID or deviceId to prevent duplicates
      const filtered = prev.filter(s => s.id !== source.id && s.deviceId !== source.deviceId);
      return [...filtered, source];
    });
  }, []);

  const handleCameraRemoved = useCallback((sourceId: string) => {
    console.log("🗑️ Camera removed in recording:", sourceId);
    setWebrtcSources(prev => prev.filter(s => s.id !== sourceId));
    
    // Remove video element ref
    const videoElement = videoRefs.current.get(sourceId);
    if (videoElement) {
      videoElement.srcObject = null;
      videoRefs.current.delete(sourceId);
    }
  }, []);

  const handleCameraConnected = useCallback((sourceId: string, stream: MediaStream) => {
    console.log("✅ Camera connected in recording:", sourceId);
    
    // Update source status
    setWebrtcSources(prev => prev.map(source => 
      source.id === sourceId 
        ? { ...source, status: 'connected', stream }
        : source
    ));

    // Attach stream to video element
    setTimeout(() => {
      const videoElement = videoRefs.current.get(sourceId);
      if (videoElement && stream) {
        console.log(`🔗 Attaching stream to video element for ${sourceId}`);
        videoElement.srcObject = stream;
        videoElement.play().catch(console.error);
      }
    }, 100);
  }, []);

  const handleCameraDisconnected = useCallback((sourceId: string) => {
    console.log("🔌 Camera disconnected in recording:", sourceId);
    setWebrtcSources(prev => prev.map(source => 
      source.id === sourceId 
        ? { ...source, status: 'disconnected', stream: undefined }
        : source
    ));
  }, []);

  // Initialize WebRTC connection and load cameras
  useEffect(() => {
    console.log("🔄 RecordingCameraPanel useEffect triggered");
    
    const initializeWebRTC = async () => {
      try {
        console.log("🚀 Initializing WebRTC for recording...");
        
        // Always load existing cameras first, regardless of connection status
        const loadExistingCameras = () => {
          const existingSources = webRTCManager.getAllCameras();
          console.log("📹 Loading existing WebRTC cameras for recording:", existingSources.length, existingSources.map(s => ({ name: s.name, status: s.status, hasStream: !!s.stream })));
          
          if (existingSources.length > 0) {
            // Deduplicate by deviceId and ID to prevent duplicates
            const uniqueSources = existingSources.reduce((acc, source) => {
              const existingIndex = acc.findIndex(s => s.id === source.id || s.deviceId === source.deviceId);
              if (existingIndex === -1) {
                acc.push(source);
              } else {
                // Keep the most recent one (higher timestamp or connected status)
                if (source.status === 'connected' && acc[existingIndex].status !== 'connected') {
                  acc[existingIndex] = source;
                }
              }
              return acc;
            }, [] as UnifiedCameraSource[]);
            
            console.log("📹 Deduplicated sources:", uniqueSources.length);
            setWebrtcSources(uniqueSources);
            
            // Setup video streams for existing cameras (use deduplicated sources)
            uniqueSources.forEach(source => {
              console.log(`🎥 Setting up stream for existing camera: ${source.name}, status: ${source.status}, hasStream: ${!!source.stream}`);
              if (source.stream && source.status === 'connected') {
                // Use a slightly longer timeout to ensure DOM is ready
                setTimeout(() => {
                  const videoElement = videoRefs.current.get(source.id);
                  if (videoElement && source.stream) {
                    console.log(`🔗 Attaching stream to video for ${source.name}`);
                    videoElement.srcObject = source.stream;
                    videoElement.play().catch(console.error);
                  } else {
                    console.log(`⚠️ Video element or stream not available for ${source.name}`, { 
                      hasElement: !!videoElement, 
                      hasStream: !!source.stream 
                    });
                  }
                }, 200);
              }
            });
          } else {
            console.log("📹 No existing cameras found in WebRTC manager");
          }
        };

        // Setup event listeners
        webRTCManager.on('camera-added', handleCameraAdded);
        webRTCManager.on('camera-removed', handleCameraRemoved);
        webRTCManager.on('camera-connected', handleCameraConnected);
        webRTCManager.on('camera-disconnected', handleCameraDisconnected);
        webRTCManager.on('connected', () => {
          console.log("✅ Connected to WebRTC signaling server in recording");
          setIsConnectedToSignaling(true);
          // Reload cameras when we connect
          loadExistingCameras();
        });
        webRTCManager.on('disconnected', () => {
          console.log("🔌 Disconnected from WebRTC signaling server in recording");
          setIsConnectedToSignaling(false);
        });

        // Load cameras immediately
        loadExistingCameras();

        // Check if already connected
        if (webRTCManager.isConnectedToSignaling()) {
          console.log("✅ WebRTC already connected");
          setIsConnectedToSignaling(true);
        } else {
          console.log("🔄 WebRTC not connected, attempting connection...");
          // Configure and connect if not already connected
          if (!webRTCManager.config.signalingUrl.includes(baseUrl)) {
            webRTCManager.config.signalingUrl = baseUrl.replace('http', 'ws') + '/ws/webrtc';
          }
          await webRTCManager.connect();
        }
        
      } catch (error) {
        console.error("❌ Failed to initialize WebRTC for recording:", error);
      }
    };

    initializeWebRTC();

    // Cleanup event listeners on unmount
    return () => {
      webRTCManager.off('camera-added', handleCameraAdded);
      webRTCManager.off('camera-removed', handleCameraRemoved);
      webRTCManager.off('camera-connected', handleCameraConnected);
      webRTCManager.off('camera-disconnected', handleCameraDisconnected);
    };
  }, [baseUrl, handleCameraAdded, handleCameraRemoved, handleCameraConnected, handleCameraDisconnected]);

  // Get available cameras (only connected ones for display)
  const getAvailableCameras = () => {
    return webrtcSources.filter(source => source.status === 'connected');
  };

  // Get grid classes for camera layout (optimized for recording mode)
  const getCameraGridClasses = () => {
    const cameraCount = getAvailableCameras().length;
    
    if (cameraCount === 0) return "";
    if (cameraCount === 1) return "flex flex-col gap-2"; // 1 camera: single column
    if (cameraCount === 2) return "flex flex-col gap-2"; // 2 cameras: stacked
    if (cameraCount >= 3) return "grid grid-cols-1 gap-2"; // 3+ cameras: single column grid
  };

  const availableCameras = getAvailableCameras();

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {availableCameras.length > 0 ? (
        <div className={cn("flex-1 min-h-0", getCameraGridClasses())}>
          {availableCameras.map((source) => (
              <RecordingCameraDisplay
                key={source.id}
                source={source}
                videoRef={(el) => {
                  if (el) {
                    videoRefs.current.set(source.id, el);
                  } else {
                    videoRefs.current.delete(source.id);
                  }
                }}
              />
            ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-500 h-32">
          <VideoOff className="h-6 w-6 mb-2" />
          <span className="text-xs text-center">
            No cameras available
          </span>
          <span className="text-xs text-center mt-1 text-gray-600">
            Configure cameras in settings
          </span>
        </div>
      )}
    </div>
  );
};

// Camera Display Component optimized for recording
interface RecordingCameraDisplayProps {
  source: UnifiedCameraSource;
  videoRef: (el: HTMLVideoElement | null) => void;
}

const RecordingCameraDisplay: React.FC<RecordingCameraDisplayProps> = ({
  source,
  videoRef,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Handle video ref assignment and stream management
  const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElementRef.current = el;
    videoRef(el);
  }, [videoRef]);

  // Use useEffect to manage srcObject changes to prevent flashing
  useEffect(() => {
    const videoElement = videoElementRef.current;
    if (videoElement && source.stream && source.status === 'connected') {
      // Only update srcObject if it's different to prevent flashing
      if (videoElement.srcObject !== source.stream) {
        console.log(`🔗 Updating srcObject for ${source.name}`);
        videoElement.srcObject = source.stream;
        videoElement.play().catch(console.error);
      }
    } else if (videoElement && (!source.stream || source.status !== 'connected')) {
      // Clear srcObject when stream is not available
      if (videoElement.srcObject) {
        console.log(`🔗 Clearing srcObject for ${source.name}`);
        videoElement.srcObject = null;
      }
    }
  }, [source.stream, source.status, source.name]);

  const getStatusColor = () => {
    switch (source.status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'disconnected': return 'bg-red-500';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
  };

  const handleVideoError = () => {
    setIsPlaying(false);
    console.error(`Video playback error for camera ${source.name}`);
  };

  // Check if this is a remote camera (external) waiting for connection
  const isRemoteCamera = source.type === 'remote';
  const shouldShowQRMessage = isRemoteCamera && !source.stream && source.status === 'connecting';

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col p-2 min-h-0 aspect-video">
      <div className="flex-1 bg-black rounded mb-2 flex items-center justify-center relative overflow-hidden">
        {source.stream && source.status === 'connected' ? (
          <>
            <video
              ref={handleVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              onPlay={handleVideoPlay}
              onError={handleVideoError}
            />
            
            {/* Stream status indicator */}
            <div className="absolute top-1 right-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
            </div>
            
            {/* LIVE badge */}
            <div className="absolute top-1 left-1">
              <div className="bg-black/50 px-2 py-1 rounded text-xs text-white">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                  <span>LIVE</span>
                </div>
              </div>
            </div>
          </>
        ) : shouldShowQRMessage ? (
          <div className="flex flex-col items-center justify-center text-gray-500">
            <Camera className="h-4 w-4 mb-1" />
            <span className="text-xs text-center">
              Scan QR in camera config
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500">
            <WifiOff className="h-4 w-4 mb-1" />
            <span className="text-xs text-center">
              {source.status === 'connecting' ? 'Connecting...' : 'No Stream'}
            </span>
          </div>
        )}
      </div>
      
      <div className="text-center">
        <span className="text-white text-xs font-medium block truncate">
          {source.name}
        </span>
        <span className="text-gray-500 text-xs block truncate">
          {source.id.substring(0, 8)}...
        </span>
      </div>
    </div>
  );
};

export default RecordingCameraPanel;