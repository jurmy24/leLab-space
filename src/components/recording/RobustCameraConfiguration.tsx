import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Camera, Plus, X, Video, VideoOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";
import { useToast } from "@/hooks/use-toast";
import { 
  RobustCameraConfig, 
  createCameraHash, 
  validateCameraConfig,
  findCurrentDeviceIndex,
  cleanupCameraConfigs,
  getCameraDisplayName,
  getCameraStreamingId,
  sortCamerasConsistently,
  convertFromRobustConfig,
  convertToRobustConfig
} from "@/utils/cameraUtils";

// Keep legacy interface for compatibility
export interface CameraConfig {
  id: string;
  name: string;
  type: string;
  camera_index?: number;
  device_id: string;
  width: number;
  height: number;
  fps?: number;
}

interface RobustCameraConfigurationProps {
  cameras: CameraConfig[];
  onCamerasChange: (cameras: CameraConfig[]) => void;
  releaseStreamsRef?: React.MutableRefObject<(() => void) | null>;
  loadSavedCameras?: boolean;
}

interface DetectedCamera {
  index: number;
  deviceId: string;
  name: string;
  available: boolean;
}

const RobustCameraConfiguration: React.FC<RobustCameraConfigurationProps> = ({
  cameras,
  onCamerasChange,
  releaseStreamsRef,
  loadSavedCameras = true,
}) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const { toast } = useToast();

  // Robust camera management state
  const [robustConfigs, setRobustConfigs] = useState<RobustCameraConfig[]>([]);
  const [detectedCameras, setDetectedCameras] = useState<DetectedCamera[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<string>("");
  const [cameraName, setCameraName] = useState("");
  const [isLoadingCameras, setIsLoadingCameras] = useState(false);
  const [hasDetectedOnMount, setHasDetectedOnMount] = useState(false);
  const [hasLoadedSavedCameras, setHasLoadedSavedCameras] = useState(false);
  const [cameraStreams, setCameraStreams] = useState<Map<string, MediaStream>>(new Map());

  // Convert robust configs to legacy format for parent component
  const syncToParent = useCallback((robustConfigs: RobustCameraConfig[]) => {
    const legacyConfigs = sortCamerasConsistently(robustConfigs)
      .filter(config => config.is_available)
      .map(convertFromRobustConfig);
    
    console.log("🔄 Syncing to parent - robust configs:", robustConfigs);
    console.log("🔄 Syncing to parent - legacy format:", legacyConfigs);
    
    onCamerasChange(legacyConfigs);
  }, [onCamerasChange]);

  // Load saved camera configurations on mount
  useEffect(() => {
    if (loadSavedCameras) {
      setHasLoadedSavedCameras(false);
      setHasDetectedOnMount(false);
      loadSavedCameraConfigs();
    }
  }, [loadSavedCameras]);

  // Auto-detect cameras if no saved cameras were loaded
  useEffect(() => {
    if (!hasDetectedOnMount && hasLoadedSavedCameras && robustConfigs.length === 0 && loadSavedCameras) {
      console.log("🔍 No saved cameras found, starting auto-detection...");
      detectAvailableCameras();
      setHasDetectedOnMount(true);
    }
  }, [hasDetectedOnMount, hasLoadedSavedCameras, robustConfigs.length, loadSavedCameras]);

  const loadSavedCameraConfigs = async () => {
    try {
      console.log("🔄 Loading saved camera configurations...");
      const response = await fetchWithHeaders(`${baseUrl}/cameras/config`);
      const data = await response.json();
      
      if (data.status === "success" && data.camera_config && data.camera_config.cameras) {
        const camerasFromBackend = data.camera_config.cameras;
        console.log("📦 Raw cameras from backend:", camerasFromBackend);
        
        // Convert legacy backend format to robust format
        const robustConfigs: RobustCameraConfig[] = Object.entries(camerasFromBackend).map(([name, config]: [string, any]) => {
          const deviceId = config.device_id || `fallback_${name}`;
          const hash = createCameraHash(deviceId, name);
          
          return {
            hash,
            device_id: deviceId,
            user_name: name,
            width: config.width || 640,
            height: config.height || 480,
            fps: config.fps || 30,
            last_detected_index: config.index_or_path || 0,
            last_seen: config.last_seen || new Date().toISOString(),
            is_available: true, // Will be validated next
          };
        });

        console.log("🔄 Converted to robust configs:", robustConfigs);
        
        // Validate and clean up configs
        const cleanedConfigs = await cleanupCameraConfigs(robustConfigs);
        console.log("🧹 Cleaned configs:", cleanedConfigs);
        
        setRobustConfigs(cleanedConfigs);
        syncToParent(cleanedConfigs);
        
        // Start previews for available cameras
        const availableConfigs = cleanedConfigs.filter(config => config.is_available);
        console.log("🎥 Starting previews for available cameras:", availableConfigs.map(c => c.user_name));
        
        availableConfigs.forEach((config, index) => {
          setTimeout(() => {
            startCameraPreview(convertFromRobustConfig(config));
          }, index * 100);
        });
      } else {
        console.log("ℹ️ No saved camera configurations found");
        setRobustConfigs([]);
        syncToParent([]);
      }
    } catch (error) {
      console.error("Error loading saved camera configs:", error);
      setRobustConfigs([]);
      syncToParent([]);
    } finally {
      setHasLoadedSavedCameras(true);
    }
  };

  const detectAvailableCameras = async () => {
    console.log("🚀 Detecting available cameras...");
    setIsLoadingCameras(true);
    try {
      // Request camera permissions
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((track) => track.stop());
        console.log("✅ Camera permission granted");
      } catch (permError) {
        console.warn("⚠️ Camera permission denied:", permError);
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");

      console.log("🔍 Detected video devices:", videoDevices.map((d, i) => ({
        index: i,
        deviceId: d.deviceId,
        label: d.label,
      })));

      const detected = videoDevices.map((device, index) => ({
        index,
        deviceId: device.deviceId,
        name: device.label || `Camera ${index + 1}`,
        available: true,
      }));

      setDetectedCameras(detected);
      console.log("✅ Camera detection completed:", detected);
    } catch (error) {
      console.error("📡 Error detecting cameras:", error);
      toast({
        title: "Camera Detection Failed",
        description: "Could not detect available cameras. Please check permissions.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCameras(false);
    }
  };

  const startCameraPreview = async (cameraConfig: CameraConfig) => {
    try {
      console.log("🎥 Starting preview for:", cameraConfig.name, "device_id:", cameraConfig.device_id);

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: cameraConfig.device_id },
          width: { ideal: cameraConfig.width, min: 320, max: 1920 },
          height: { ideal: cameraConfig.height, min: 240, max: 1080 },
          frameRate: { ideal: cameraConfig.fps || 30, min: 10, max: 60 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verify stream is actually from the correct device
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log("✅ Preview started with device:", settings.deviceId, "label:", videoTrack.label);
        
        if (settings.deviceId !== cameraConfig.device_id) {
          console.warn("⚠️ Device ID mismatch! Expected:", cameraConfig.device_id, "Got:", settings.deviceId);
        }
      }

      setCameraStreams((prev) => new Map(prev.set(cameraConfig.id, stream)));
      return stream;
    } catch (error) {
      console.error("Error starting camera preview:", error);
      toast({
        title: "Camera Preview Failed",
        description: `Could not start preview for ${cameraConfig.name}`,
        variant: "destructive",
      });
      return null;
    }
  };

  const stopCameraPreview = (cameraId: string) => {
    const stream = cameraStreams.get(cameraId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setCameraStreams((prev) => {
        const newMap = new Map(prev);
        newMap.delete(cameraId);
        return newMap;
      });
    }
  };

  const addCamera = async () => {
    if (!selectedCameraIndex || !cameraName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a camera and provide a name.",
        variant: "destructive",
      });
      return;
    }

    const cameraIndex = parseInt(selectedCameraIndex);
    const selectedCamera = detectedCameras.find((cam) => cam.index === cameraIndex);

    if (!selectedCamera) {
      toast({
        title: "Invalid Camera",
        description: "Selected camera is not available.",
        variant: "destructive",
      });
      return;
    }

    // Check if camera with this device_id already exists
    if (robustConfigs.some((config) => config.device_id === selectedCamera.deviceId)) {
      toast({
        title: "Camera Already Added",
        description: "This camera is already in the configuration.",
        variant: "destructive",
      });
      return;
    }

    // Create robust camera config
    const hash = createCameraHash(selectedCamera.deviceId, cameraName.trim());
    const newRobustConfig: RobustCameraConfig = {
      hash,
      device_id: selectedCamera.deviceId,
      user_name: cameraName.trim(),
      width: 640,
      height: 480,
      fps: 30,
      last_detected_index: selectedCamera.index,
      last_seen: new Date().toISOString(),
      is_available: true,
    };

    console.log("🆕 Creating new robust camera config:", newRobustConfig);

    // Save to backend using hash as identifier
    try {
      const backendConfig = {
        type: "browser",
        device_id: newRobustConfig.device_id,
        index_or_path: newRobustConfig.last_detected_index,
        width: newRobustConfig.width,
        height: newRobustConfig.height,
        fps: newRobustConfig.fps,
        last_seen: newRobustConfig.last_seen,
        hash: newRobustConfig.hash, // Include hash for future validation
      };

      const saveResponse = await fetchWithHeaders(`${baseUrl}/cameras/config/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_name: newRobustConfig.user_name,
          camera_config: backendConfig
        }),
      });

      const saveResult = await saveResponse.json();
      
      if (saveResult.status === "success") {
        console.log("✅ Camera configuration saved to backend");
      } else {
        console.error("❌ Error saving camera config:", saveResult.message);
      }
    } catch (error) {
      console.error("Error saving camera configuration:", error);
    }

    // Update local state
    const updatedConfigs = [...robustConfigs, newRobustConfig];
    setRobustConfigs(updatedConfigs);
    syncToParent(updatedConfigs);

    // Start preview
    await startCameraPreview(convertFromRobustConfig(newRobustConfig));

    // Reset form
    setSelectedCameraIndex("");
    setCameraName("");

    toast({
      title: "Camera Added",
      description: `${newRobustConfig.user_name} has been added successfully.`,
    });
  };

  const removeCamera = async (cameraHash: string) => {
    const config = robustConfigs.find(c => c.hash === cameraHash);
    if (!config) return;

    // Remove from backend
    try {
      const response = await fetchWithHeaders(`${baseUrl}/cameras/config/${encodeURIComponent(config.user_name)}`, {
        method: "DELETE",
      });
      
      const result = await response.json();
      if (result.status === "success") {
        console.log(`✅ Camera "${config.user_name}" removed from backend`);
      }
    } catch (error) {
      console.error("Error removing camera from backend:", error);
    }

    // Stop preview
    stopCameraPreview(config.hash);

    // Update local state
    const updatedConfigs = robustConfigs.filter(c => c.hash !== cameraHash);
    setRobustConfigs(updatedConfigs);
    syncToParent(updatedConfigs);

    toast({
      title: "Camera Removed",
      description: `${config.user_name} has been removed.`,
    });
  };

  const updateCamera = (cameraHash: string, updates: Partial<RobustCameraConfig>) => {
    const updatedConfigs = robustConfigs.map((config) =>
      config.hash === cameraHash ? { ...config, ...updates } : config
    );
    setRobustConfigs(updatedConfigs);
    syncToParent(updatedConfigs);
  };

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      cameraStreams.forEach((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
    };
  }, []);

  // Function to release all camera streams
  const releaseAllCameraStreams = useCallback(() => {
    console.log("🔓 Releasing all camera streams...");
    cameraStreams.forEach((stream, cameraId) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    setCameraStreams(new Map());
  }, [cameraStreams]);

  // Expose release function to parent
  useEffect(() => {
    if (releaseStreamsRef) {
      releaseStreamsRef.current = releaseAllCameraStreams;
    }
  }, [releaseStreamsRef, releaseAllCameraStreams]);

  // Get available cameras for display
  const availableConfigs = sortCamerasConsistently(robustConfigs.filter(config => config.is_available));
  const unavailableConfigs = robustConfigs.filter(config => !config.is_available);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
          Robust Camera Configuration
        </h3>
        <div className="flex gap-2">
          <Button
            onClick={detectAvailableCameras}
            disabled={isLoadingCameras}
            size="sm"
            variant="outline"
            className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
          >
            {isLoadingCameras ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Cameras
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Add Camera Section */}
      {detectedCameras.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <h4 className="text-md font-medium text-gray-300">Add Camera</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">
                Available Cameras
              </Label>
              <Select
                value={selectedCameraIndex}
                onValueChange={setSelectedCameraIndex}
                disabled={isLoadingCameras}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {detectedCameras.map((camera) => {
                    const isAlreadyAdded = robustConfigs.some(config => config.device_id === camera.deviceId);
                    return (
                      <SelectItem
                        key={camera.index}
                        value={camera.index.toString()}
                        className="text-white hover:bg-gray-700"
                        disabled={isAlreadyAdded}
                      >
                        {camera.name} (Index {camera.index})
                        {isAlreadyAdded && " (Already added)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">
                Camera Name
              </Label>
              <Input
                value={cameraName}
                onChange={(e) => setCameraName(e.target.value)}
                placeholder="e.g., workspace_cam"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <Button
                onClick={addCamera}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                disabled={!selectedCameraIndex || !cameraName.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Camera
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Available Cameras */}
      {availableConfigs.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-300">
            Available Cameras ({availableConfigs.length})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {availableConfigs.map((config) => (
              <RobustCameraPreview
                key={config.hash}
                config={config}
                stream={cameraStreams.get(config.hash)}
                onRemove={() => removeCamera(config.hash)}
                onUpdate={(updates) => updateCamera(config.hash, updates)}
                onStartPreview={() => startCameraPreview(convertFromRobustConfig(config))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unavailable Cameras Warning */}
      {unavailableConfigs.length > 0 && (
        <div className="space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <h4 className="text-md font-medium text-yellow-500">
                Unavailable Cameras ({unavailableConfigs.length})
              </h4>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              These cameras were previously configured but are no longer detected. They may be disconnected or in use by another application.
            </p>
            <div className="space-y-2">
              {unavailableConfigs.map((config) => (
                <div key={config.hash} className="flex items-center justify-between bg-gray-800/50 rounded p-2">
                  <div>
                    <span className="text-gray-300">{config.user_name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      Last seen: {new Date(config.last_seen).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    onClick={() => removeCamera(config.hash)}
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {availableConfigs.length === 0 && unavailableConfigs.length === 0 && !isLoadingCameras && (
        <div className="text-center py-8 text-gray-500">
          <Camera className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p>No cameras configured.</p>
          <p className="text-sm">Click "Refresh Cameras" to detect available cameras and add them.</p>
        </div>
      )}
    </div>
  );
};

// Robust Camera Preview Component
interface RobustCameraPreviewProps {
  config: RobustCameraConfig;
  stream?: MediaStream;
  onRemove: () => void;
  onUpdate: (updates: Partial<RobustCameraConfig>) => void;
  onStartPreview: () => void;
}

const RobustCameraPreview: React.FC<RobustCameraPreviewProps> = ({
  config,
  stream,
  onRemove,
  onUpdate,
  onStartPreview,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      console.log(`🎥 Setting stream for camera: ${config.user_name} (${config.hash})`);
      video.srcObject = stream;

      const playVideo = async () => {
        try {
          await video.play();
          setIsPreviewActive(true);
        } catch (error) {
          console.error(`Error playing video for ${config.user_name}:`, error);
          video.muted = true;
          try {
            await video.play();
            setIsPreviewActive(true);
          } catch (mutedError) {
            setIsPreviewActive(false);
          }
        }
      };

      if (video.readyState >= 1) {
        playVideo();
      } else {
        video.addEventListener("loadedmetadata", playVideo, { once: true });
      }
    } else {
      setIsPreviewActive(false);
    }
  }, [stream, config.user_name, config.hash]);

  useEffect(() => {
    if (!stream && !isPreviewActive) {
      onStartPreview();
    }
  }, [stream, isPreviewActive, onStartPreview]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Camera Preview */}
      <div className="aspect-[4/3] bg-gray-800 relative">
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2">
              <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400">
                  {isPreviewActive ? "LIVE" : "LOADING"}
                </span>
              </div>
            </div>
            <div className="absolute top-2 right-2">
              <div className="bg-black/50 px-2 py-1 rounded text-xs text-white">
                Hash: {config.hash}
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <VideoOff className="w-8 h-8 text-gray-500 mb-2" />
            <span className="text-gray-500 text-sm">Preview not available</span>
            <Button
              onClick={onStartPreview}
              size="sm"
              className="mt-2 bg-blue-500 hover:bg-blue-600"
            >
              <Video className="w-3 h-3 mr-1" />
              Start Preview
            </Button>
          </div>
        )}
      </div>

      {/* Camera Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="font-medium text-white truncate">
            {getCameraDisplayName(config)}
          </h5>
          <Button
            onClick={onRemove}
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-16">Resolution:</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={config.width}
                onChange={(e) =>
                  onUpdate({ width: parseInt(e.target.value) || 640 })
                }
                className="bg-gray-800 border-gray-700 text-white text-xs h-6 px-2 w-16"
                min="320"
                max="1920"
              />
              <span>×</span>
              <Input
                type="number"
                value={config.height}
                onChange={(e) =>
                  onUpdate({ height: parseInt(e.target.value) || 480 })
                }
                className="bg-gray-800 border-gray-700 text-white text-xs h-6 px-2 w-16"
                min="240"
                max="1080"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16">FPS:</span>
            <Input
              type="number"
              value={config.fps}
              onChange={(e) =>
                onUpdate({ fps: parseInt(e.target.value) || 30 })
              }
              className="bg-gray-800 border-gray-700 text-white text-xs h-6 px-2 w-16"
              min="10"
              max="60"
            />
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <div>Device ID: {config.device_id.substring(0, 16)}...</div>
          <div>Hash: {config.hash}</div>
          <div>Index: {config.last_detected_index}</div>
        </div>
      </div>
    </div>
  );
};

export default RobustCameraConfiguration;