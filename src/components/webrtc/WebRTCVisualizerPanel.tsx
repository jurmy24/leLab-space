import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, VideoOff, Camera, Wifi, WifiOff, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import UrdfViewer from "../UrdfViewer";
import UrdfProcessorInitializer from "../UrdfProcessorInitializer";
import Logo from "@/components/Logo";
import { webRTCManager } from "@/utils/webrtc/WebRTCManager";
import { UnifiedCameraSource } from "@/types/webrtc";
import { useApi } from "@/contexts/ApiContext";

interface WebRTCVisualizerPanelProps {
  onGoBack: () => void;
  className?: string;
}

const WebRTCVisualizerPanel: React.FC<WebRTCVisualizerPanelProps> = ({
  onGoBack,
  className,
}) => {
  const { baseUrl } = useApi();
  const [webrtcSources, setWebrtcSources] = useState<UnifiedCameraSource[]>([]);
  const [isConnectedToSignaling, setIsConnectedToSignaling] = useState(false);
  const [signalingStats, setSignalingStats] = useState<any>(null);
  
  // Video element refs for WebRTC streams
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // WebRTC event handlers (with useCallback to maintain references)
  const handleCameraAdded = useCallback((source: UnifiedCameraSource) => {
    console.log("📹 Camera added in teleoperation:", source.name);
    setWebrtcSources(prev => {
      // Remove any existing source with same ID or deviceId to prevent duplicates
      const filtered = prev.filter(s => s.id !== source.id && s.deviceId !== source.deviceId);
      return [...filtered, source];
    });
  }, []);

  const handleCameraRemoved = useCallback((sourceId: string) => {
    console.log("🗑️ Camera removed in teleoperation:", sourceId);
    setWebrtcSources(prev => prev.filter(s => s.id !== sourceId));
    
    // Remove video element ref
    const videoElement = videoRefs.current.get(sourceId);
    if (videoElement) {
      videoElement.srcObject = null;
      videoRefs.current.delete(sourceId);
    }
  }, []);

  const handleCameraConnected = useCallback((sourceId: string, stream: MediaStream) => {
    console.log("✅ Camera connected in teleoperation:", sourceId);
    
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
    console.log("🔌 Camera disconnected in teleoperation:", sourceId);
    setWebrtcSources(prev => prev.map(source => 
      source.id === sourceId 
        ? { ...source, status: 'disconnected', stream: undefined }
        : source
    ));
  }, []);

  // Initialize WebRTC connection and load cameras
  useEffect(() => {
    console.log("🔄 WebRTCVisualizerPanel useEffect triggered");
    
    const initializeWebRTC = async () => {
      try {
        console.log("🚀 Initializing WebRTC for teleoperation...");
        console.log("📊 Current WebRTC manager state:", {
          isConnected: webRTCManager.isConnectedToSignaling(),
          cameraCount: webRTCManager.getAllCameras().length,
          cameras: webRTCManager.getAllCameras().map(c => ({ id: c.id, name: c.name, status: c.status })),
          signalingUrl: webRTCManager.config.signalingUrl
        });
        
        // Always load existing cameras first, regardless of connection status
        const loadExistingCameras = () => {
          const existingSources = webRTCManager.getAllCameras();
          console.log("📹 Loading existing WebRTC cameras for teleoperation:", existingSources.length, existingSources.map(s => ({ name: s.name, status: s.status, hasStream: !!s.stream })));
          
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
          console.log("✅ Connected to WebRTC signaling server in teleoperation");
          setIsConnectedToSignaling(true);
          // Reload cameras when we connect
          loadExistingCameras();
          fetchSignalingStats();
        });
        webRTCManager.on('disconnected', () => {
          console.log("🔌 Disconnected from WebRTC signaling server in teleoperation");
          setIsConnectedToSignaling(false);
        });

        // Load cameras immediately
        loadExistingCameras();

        // Check if already connected
        if (webRTCManager.isConnectedToSignaling()) {
          console.log("✅ WebRTC already connected");
          setIsConnectedToSignaling(true);
          fetchSignalingStats();
        } else {
          console.log("🔄 WebRTC not connected, attempting connection...");
          // Configure and connect if not already connected
          if (!webRTCManager.config.signalingUrl.includes(baseUrl)) {
            webRTCManager.config.signalingUrl = baseUrl.replace('http', 'ws') + '/ws/webrtc';
          }
          await webRTCManager.connect();
        }
        
      } catch (error) {
        console.error("❌ Failed to initialize WebRTC for teleoperation:", error);
      }
    };

    initializeWebRTC();

    // Cleanup event listeners on unmount
    return () => {
      // Don't remove ALL listeners, just remove the specific ones we added
      // to avoid breaking other components that might be listening
      webRTCManager.off('camera-added', handleCameraAdded);
      webRTCManager.off('camera-removed', handleCameraRemoved);
      webRTCManager.off('camera-connected', handleCameraConnected);
      webRTCManager.off('camera-disconnected', handleCameraDisconnected);
    };
  }, [baseUrl, handleCameraAdded, handleCameraRemoved, handleCameraConnected, handleCameraDisconnected]);

  // Additional effect to ensure cameras are always loaded on mount
  useEffect(() => {
    console.log("🔄 Additional effect: checking for cameras on component mount");
    const existingSources = webRTCManager.getAllCameras();
    console.log("📊 Found cameras in additional effect:", existingSources.length, existingSources.map(s => s.name));
    
    if (existingSources.length > 0) {
      setWebrtcSources([...existingSources]);
      console.log("✅ Set cameras in additional effect");
    }
  }, []); // Empty dependency array - runs only on mount

  const fetchSignalingStats = async () => {
    try {
      const response = await fetch(`${baseUrl}/webrtc/status`);
      const data = await response.json();
      setSignalingStats(data.stats);
    } catch (error) {
      console.error("Error fetching signaling stats:", error);
    }
  };

  // Get available cameras (only connected ones for display)
  const getAvailableCameras = () => {
    return webrtcSources.filter(source => source.status === 'connected');
  };

  // Get responsive layout classes based on number of cameras
  const getCameraLayoutClasses = () => {
    const cameraCount = getAvailableCameras().length;
    
    if (cameraCount === 0) return "lg:w-80";
    if (cameraCount === 1) return "lg:w-80"; // 1 camera: single column, full width
    if (cameraCount === 2) return "lg:w-80"; // 2 cameras: single column, stacked
    if (cameraCount === 3) return "lg:w-80"; // 3 cameras: single column, full height
    if (cameraCount === 4) return "lg:w-96"; // 4 cameras: 2x2 grid
    if (cameraCount <= 6) return "lg:w-[32rem]"; // 5-6 cameras: 3x2 grid
    
    return "lg:w-[36rem]"; // 7+ cameras: wider grid
  };

  // Get grid classes for camera layout
  const getCameraGridClasses = () => {
    const cameraCount = getAvailableCameras().length;
    
    if (cameraCount === 0) return "";
    if (cameraCount === 1) return "flex flex-col gap-3 items-center"; // 1 camera: centered
    if (cameraCount === 2) return "flex flex-col gap-3"; // 2 cameras: stacked
    if (cameraCount === 3) return "flex flex-col gap-3"; // 3 cameras: single column
    if (cameraCount === 4) return "grid grid-cols-2 gap-3"; // 4 cameras: 2x2 grid
    if (cameraCount <= 6) return "grid grid-cols-3 gap-2"; // 5-6 cameras: 3x2 grid
    
    return "grid grid-cols-3 gap-2"; // 7+ cameras: 3 columns
  };

  const availableCameras = getAvailableCameras();

  return (
    <div
      className={cn(
        "w-full p-2 sm:p-4 space-y-4 lg:space-y-0 lg:space-x-4 flex flex-col lg:flex-row min-h-full",
        className
      )}
    >
      <div className="bg-gray-900 rounded-lg p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onGoBack}
            className="text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo iconOnly={true} />
          <div className="w-px h-6 bg-gray-700" />
          <h2 className="text-xl font-medium text-gray-200">Teleoperation</h2>
          
        </div>
        <div className="flex-1 bg-black rounded border border-gray-800 min-h-[50vh] lg:min-h-0">
          <UrdfProcessorInitializer />
          <UrdfViewer />
        </div>
      </div>

      <div className={cn("flex-shrink-0 flex flex-col max-h-[calc(100vh-4rem)] lg:max-h-full", getCameraLayoutClasses())}>
        {availableCameras.length > 0 ? (
          <div className={cn("overflow-y-auto min-h-0 flex-1", getCameraGridClasses())}>
            {availableCameras.map((source) => (
              <WebRTCCameraDisplay
                key={source.id}
                source={source}
                isSingleCamera={availableCameras.length === 1}
                videoRef={(el) => {
                  if (el) {
                    videoRefs.current.set(source.id, el);
                    // If stream is already available, attach it
                    if (source.stream) {
                      el.srcObject = source.stream;
                      el.play().catch(console.error);
                    }
                  } else {
                    videoRefs.current.delete(source.id);
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div className="aspect-video bg-gray-900 rounded-lg border border-gray-800 flex flex-col items-center justify-center p-4">
            <VideoOff className="h-8 w-8 text-gray-600 mb-2" />
            <span className="text-gray-500 text-xs text-center">
              No cameras available
            </span>
            <span className="text-gray-600 text-xs text-center mt-1">
              Configure cameras in settings
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// WebRTC Camera Display Component
interface WebRTCCameraDisplayProps {
  source: UnifiedCameraSource;
  videoRef: (el: HTMLVideoElement | null) => void;
  isSingleCamera?: boolean;
}

const WebRTCCameraDisplay: React.FC<WebRTCCameraDisplayProps> = ({
  source,
  videoRef,
  isSingleCamera = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

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

  // Check if this is a remote camera (phone) waiting for connection
  const isRemoteCamera = source.type === 'remote';
  const shouldShowQRMessage = isRemoteCamera && !source.stream && source.status === 'connecting';

  return (
    <div className={cn(
      "bg-gray-900 rounded-lg border border-gray-800 flex flex-col items-center justify-center p-2 min-h-0",
      isSingleCamera ? "h-1/2 aspect-video" : "flex-1"
    )}>
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 bg-black rounded mb-2 flex items-center justify-center relative overflow-hidden">
          {source.stream && source.status === 'connected' ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  "w-full h-full",
                  isSingleCamera ? "object-contain" : "object-cover"
                )}
                onPlay={handleVideoPlay}
                onError={handleVideoError}
              />
              
              {/* Stream status indicator */}
              <div className="absolute top-1 right-1">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
              </div>
              
              {/* WebRTC badge */}
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
              <Camera className="h-6 w-6 mb-1" />
              <span className="text-xs text-center">
                Scan QR in camera config
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-500">
              <WifiOff className="h-6 w-6 mb-1" />
              <span className="text-xs text-center">
                {source.status === 'connecting' ? 'Connecting...' : 'No Stream'}
              </span>
            </div>
          )}
        </div>
        
        <div className="text-center">
          <span className="text-white text-xs font-medium block truncate">
            {source.name} {/* Consistent user-given name */}
          </span>
          <span className="text-gray-500 text-xs block truncate">
            {source.id.substring(0, 8)}...
          </span>
          <span className="text-gray-400 text-xs">
            {source.width}x{source.height} @ {source.fps}fps
          </span>
        </div>
      </div>
    </div>
  );
};

export default WebRTCVisualizerPanel;