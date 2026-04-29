
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, VideoOff, Camera, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import UrdfViewer from "../UrdfViewer";
import UrdfProcessorInitializer from "../UrdfProcessorInitializer";
import Logo from "@/components/Logo";
import { useApi } from "@/contexts/ApiContext";

interface VisualizerPanelProps {
  onGoBack: () => void;
  className?: string;
}

const VisualizerPanel: React.FC<VisualizerPanelProps> = ({
  onGoBack,
  className,
}) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const [cameraConfig, setCameraConfig] = useState<{[key: string]: any}>({});
  const [isLoadingCameras, setIsLoadingCameras] = useState(true);
  const [cameraStreams, setCameraStreams] = useState<{[key: string]: string}>({});
  const [streamErrors, setStreamErrors] = useState<{[key: string]: boolean}>({});

  // Load camera configuration and streaming URLs using robust system
  useEffect(() => {
    const loadCameraConfig = async () => {
      try {
        // Load camera configuration
        const response = await fetchWithHeaders(`${baseUrl}/cameras/config`);
        const data = await response.json();
        
        if (data.status === "success" && data.camera_config) {
          const cameras = data.camera_config.cameras || {};
          setCameraConfig(cameras);
          
          console.log("🎬 Loaded camera config for teleoperation:", cameras);
          
          // Generate streaming URLs using robust identifiers
          const streams: {[key: string]: string} = {};
          Object.entries(cameras).forEach(([cameraName, config]: [string, any]) => {
            // CRITICAL: Use hash if available for consistency, otherwise fall back to name
            const streamingIdentifier = config.hash || cameraName;
            const streamUrl = `${baseUrl}/cameras/stream/${encodeURIComponent(streamingIdentifier)}`;
            
            console.log(`🔗 Camera ${cameraName}: streaming via ${streamingIdentifier} -> ${streamUrl}`);
            
            // Use camera name as key for UI, but stream via hash/identifier
            streams[cameraName] = streamUrl;
          });
          setCameraStreams(streams);
          
          console.log("🔗 Generated streaming URLs:", streams);
        }
      } catch (error) {
        console.error("Error loading camera config:", error);
      } finally {
        setIsLoadingCameras(false);
      }
    };

    loadCameraConfig();
  }, [baseUrl, fetchWithHeaders]);

  // Handle camera stream errors
  const handleStreamError = (cameraName: string) => {
    setStreamErrors(prev => ({ ...prev, [cameraName]: true }));
  };

  // Handle camera stream load success
  const handleStreamLoad = (cameraName: string) => {
    setStreamErrors(prev => ({ ...prev, [cameraName]: false }));
  };

  // Get camera entries - only show configured cameras (sorted by name for consistency)
  const getCameraSlots = () => {
    const configuredCameras = Object.entries(cameraConfig);
    const cameraSlots = [];
    
    // Simple alphabetical sort by name - same as configuration modal
    configuredCameras.sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
    
    // Add only configured cameras (no empty slots)
    configuredCameras.forEach(([name, config]) => {
      cameraSlots.push({ name, config, isConfigured: true });
    });
    
    console.log("🎬 Camera slots in teleoperation (sorted by name):", cameraSlots.map(slot => ({
      name: slot.name,
      system_index: slot.config.system_index,
      index_or_path: slot.config.index_or_path,
      device_id: slot.config.device_id
    })));
    
    return cameraSlots;
  };

  // Get responsive layout classes based on number of cameras
  const getCameraLayoutClasses = () => {
    const cameraCount = getCameraSlots().length;
    
    if (cameraCount === 0) return "lg:w-80";
    if (cameraCount === 1) return "lg:w-80"; // 1 camera: single column, full width
    if (cameraCount === 2) return "lg:w-80"; // 2 cameras: single column, stacked
    if (cameraCount === 3) return "lg:w-80 lg:max-h-[70vh] lg:overflow-y-auto"; // 3 cameras: single column with scroll
    if (cameraCount === 4) return "lg:w-96"; // 4 cameras: 2x2 grid
    if (cameraCount <= 6) return "lg:w-[32rem]"; // 5-6 cameras: 3x2 grid
    
    return "lg:w-[36rem]"; // 7+ cameras: wider grid
  };

  // Get grid classes for camera layout
  const getCameraGridClasses = () => {
    const cameraCount = getCameraSlots().length;
    
    if (cameraCount === 0) return "";
    if (cameraCount === 1) return "flex flex-col gap-3"; // 1 camera: full width
    if (cameraCount === 2) return "flex flex-col gap-3"; // 2 cameras: stacked vertically
    if (cameraCount === 3) return "flex flex-col gap-3"; // 3 cameras: stacked vertically with scroll
    if (cameraCount === 4) return "grid grid-cols-2 gap-3"; // 4 cameras: 2x2
    if (cameraCount <= 6) return "grid grid-cols-3 gap-2"; // 5-6 cameras: 3x2
    
    return "grid grid-cols-3 gap-2"; // 7+ cameras: 3 columns
  };

  return (
    <div
      className={cn(
        "w-full p-2 sm:p-4 space-y-4 lg:space-y-0 lg:space-x-4 flex flex-col lg:flex-row",
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

      <div className={cn("flex-shrink-0", getCameraLayoutClasses())}>
        {getCameraSlots().length > 0 ? (
          <div className={getCameraGridClasses()}>
            {getCameraSlots().map((cameraSlot, index) => (
              <div
                key={cameraSlot.name || index}
                className="aspect-video bg-gray-900 rounded-lg border border-gray-800 flex flex-col items-center justify-center p-2"
              >
              {isLoadingCameras ? (
                <>
                  <Camera className="h-8 w-8 text-gray-600 mb-2 animate-pulse" />
                  <span className="text-gray-500 text-xs text-center">
                    Loading cameras...
                  </span>
                </>
              ) : (
                <div className="w-full h-full flex flex-col">
                  <div className="flex-1 bg-black rounded mb-2 flex items-center justify-center relative overflow-hidden">
                    {cameraStreams[cameraSlot.name!] && !streamErrors[cameraSlot.name!] ? (
                      <img
                        src={cameraStreams[cameraSlot.name!]}
                        alt={`${cameraSlot.name} live stream`}
                        className="w-full h-full object-cover"
                        onError={() => handleStreamError(cameraSlot.name!)}
                        onLoad={() => handleStreamLoad(cameraSlot.name!)}
                      />
                    ) : streamErrors[cameraSlot.name!] ? (
                      <div className="flex flex-col items-center justify-center text-red-400">
                        <WifiOff className="h-6 w-6 mb-1" />
                        <span className="text-xs text-center">Stream Error</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Wifi className="h-6 w-6 mb-1 animate-pulse" />
                        <span className="text-xs text-center">Connecting...</span>
                      </div>
                    )}
                    
                    {/* Stream status indicator */}
                    <div className="absolute top-1 right-1">
                      {cameraStreams[cameraSlot.name!] && !streamErrors[cameraSlot.name!] ? (
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      ) : streamErrors[cameraSlot.name!] ? (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      ) : (
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-white text-xs font-medium block truncate">
                      {cameraSlot.name} {/* Show consistent user-given name */}
                    </span>
                    <span className="text-gray-500 text-xs block truncate">
                      {cameraSlot.config.hash ? `Hash: ${cameraSlot.config.hash}` : `Index: ${cameraSlot.config.index_or_path}`}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {cameraSlot.config.width}x{cameraSlot.config.height} @ {cameraSlot.config.fps}fps
                    </span>
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        ) : (
          <div className="aspect-video bg-gray-900 rounded-lg border border-gray-800 flex flex-col items-center justify-center p-4">
            <VideoOff className="h-8 w-8 text-gray-600 mb-2" />
            <span className="text-gray-500 text-xs text-center">
              No Cameras Configured
            </span>
            <span className="text-gray-600 text-xs text-center mt-1">
              Configure cameras in teleoperation settings
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualizerPanel;
