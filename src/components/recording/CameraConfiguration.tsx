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
import { Camera, Plus, X, Video, VideoOff, RefreshCw } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";
import { useToast } from "@/hooks/use-toast";

export interface CameraConfig {
  id: string;
  name: string;
  type: string;
  camera_index?: number; // Keep for backend compatibility
  device_id: string; // Use this for actual camera selection
  width: number;
  height: number;
  fps?: number;
}

interface CameraConfigurationProps {
  cameras: CameraConfig[];
  onCamerasChange: (cameras: CameraConfig[]) => void;
  releaseStreamsRef?: React.MutableRefObject<(() => void) | null>; // Ref to expose stream release function
  loadSavedCameras?: boolean; // If true, load saved cameras on mount
}

interface AvailableCamera {
  index: number;
  deviceId: string;
  name: string;
  available: boolean;
  preview_image?: string; // Base64 preview from backend
}

const CameraConfiguration: React.FC<CameraConfigurationProps> = ({
  cameras,
  onCamerasChange,
  releaseStreamsRef,
  loadSavedCameras = true,
}) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const { toast } = useToast();

  const [availableCameras, setAvailableCameras] = useState<AvailableCamera[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<string>("");
  const [cameraName, setCameraName] = useState("");
  const [isLoadingCameras, setIsLoadingCameras] = useState(false);
  const [hasDetectedOnMount, setHasDetectedOnMount] = useState(false);
  const [hasLoadedSavedCameras, setHasLoadedSavedCameras] = useState(false);
  const [cameraStreams, setCameraStreams] = useState<Map<string, MediaStream>>(new Map());
  const [savedCameraConfigs, setSavedCameraConfigs] = useState<{[key: string]: any}>({});

  // Load saved camera configurations on mount
  useEffect(() => {
    if (loadSavedCameras) {
      setHasLoadedSavedCameras(false);
      setHasDetectedOnMount(false);
      loadSavedCameraConfigs();
    }
  }, [loadSavedCameras]);

  // Auto-detect cameras on component mount, but only if no saved cameras were loaded and haven't detected yet
  useEffect(() => {
    if (!hasDetectedOnMount && hasLoadedSavedCameras && cameras.length === 0 && loadSavedCameras) {
      console.log("🔍 No saved cameras found, starting auto-detection...");
      fetchAvailableCameras();
      setHasDetectedOnMount(true);
    }
  }, [hasDetectedOnMount, hasLoadedSavedCameras, cameras.length, loadSavedCameras]);

  const loadSavedCameraConfigs = async () => {
    try {
      console.log("🔄 Loading saved camera configurations from backend...");
      const response = await fetchWithHeaders(`${baseUrl}/cameras/config`);
      const data = await response.json();
      
      console.log("📡 Backend response:", data);
      
      if (data.status === "success" && data.camera_config && data.camera_config.cameras) {
        const camerasFromBackend = data.camera_config.cameras;
        console.log("📦 Raw cameras from backend:", camerasFromBackend);
        
        setSavedCameraConfigs(camerasFromBackend);
        
        // Simple conversion - just use device_id
        const savedCameras: CameraConfig[] = Object.entries(camerasFromBackend).map(([name, config]: [string, any]) => ({
          id: `saved_${name}`,
          name: name,
          type: config.type || "browser", // Default to browser type
          camera_index: config.index_or_path || 0, // Keep for reference
          device_id: config.device_id, // Primary identifier
          width: config.width || 640,
          height: config.height || 480,
          fps: config.fps || 30,
        }));
        
        // Sort by name for consistent UI order (simple and predictable)
        savedCameras.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log("🎬 Converted cameras for frontend (sorted by camera_index):", savedCameras);
        onCamerasChange(savedCameras);
        
        // Start previews for saved cameras in the correct order
        console.log("🔄 Starting previews in this order:", savedCameras.map(cam => ({
          name: cam.name,
          camera_index: cam.camera_index,
          id: cam.id
        })));
        
        savedCameras.forEach((camera, index) => {
          setTimeout(() => {
            console.log(`🎥 Starting preview ${index} for ${camera.name} (camera_index: ${camera.camera_index})`);
            startCameraPreview(camera);
          }, index * 100); // Stagger the preview starts
        });
        
        console.log("✅ Loaded saved camera configurations:", savedCameras);
        console.log("🚫 Skipping auto-detection because saved cameras exist");
      } else {
        console.log("ℹ️ No saved camera configurations found");
        onCamerasChange([]); // Ensure cameras array is empty
      }
    } catch (error) {
      console.error("Error loading saved camera configs:", error);
      onCamerasChange([]); // Ensure cameras array is empty on error
    } finally {
      setHasLoadedSavedCameras(true);
    }
  };

  const fetchAvailableCameras = async () => {
    console.log("🚀 fetchAvailableCameras() called");
    setIsLoadingCameras(true);
    try {
      // Use ONLY browser detection to avoid duplicates and device ID issues
      console.log("🔍 Using pure browser detection for consistency...");
      await detectBrowserCameras();
    } catch (error) {
      console.error("📡 Error fetching cameras:", error);
      toast({
        title: "Camera Detection Failed",
        description: "Could not detect available cameras. Please check permissions.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCameras(false);
      console.log("✅ fetchAvailableCameras() completed");
    }
  };

  const detectBrowserCameras = async () => {
    try {
      // First, request camera permissions to get proper device IDs and labels
      console.log("🔐 Requesting camera permissions for device detection...");
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log("✅ Camera permission granted, stopping temp stream");
        tempStream.getTracks().forEach((track) => track.stop());
      } catch (permError) {
        console.warn("⚠️ Camera permission denied, device IDs may be empty:", permError);
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");

      console.log("🔍 Raw video devices from enumerateDevices:", videoDevices.map((d) => ({
        deviceId: d.deviceId,
        label: d.label,
        kind: d.kind,
      })));

      const detectedCameras = videoDevices.map((device, index) => ({
        index,
        deviceId: device.deviceId,
        name: device.label || `Camera ${index + 1}`,
        available: true,
      }));

      console.log("🎬 Browser cameras detected:", detectedCameras);
      setAvailableCameras(detectedCameras);
    } catch (error) {
      console.error("Error detecting browser cameras:", error);
      toast({
        title: "Camera Detection Failed",
        description: "Could not detect available cameras. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const startCameraPreview = async (cameraConfig: CameraConfig) => {
    try {
      console.log("🎥 Starting camera preview for:", cameraConfig.name, "with device_id:", cameraConfig.device_id, "camera_index:", cameraConfig.camera_index);

      // For saved cameras, try to use the actual device_id if it doesn't start with "saved_"
      if (cameraConfig.device_id.startsWith("saved_")) {
        const savedName = cameraConfig.device_id.replace("saved_", "");
        const savedConfig = savedCameraConfigs[savedName];
        
        // If we have a real device_id in the saved config, use it
        if (savedConfig && savedConfig.device_id && !savedConfig.device_id.startsWith("saved_")) {
          const constraints: MediaStreamConstraints = {
            video: {
              deviceId: { exact: savedConfig.device_id },
              width: { ideal: cameraConfig.width, min: 320, max: 1920 },
              height: { ideal: cameraConfig.height, min: 240, max: 1080 },
              frameRate: { ideal: cameraConfig.fps || 30, min: 10, max: 60 },
            },
          };
          console.log("🔧 Using saved deviceId for camera:", savedConfig.device_id);
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          setCameraStreams((prev) => new Map(prev.set(cameraConfig.id, stream)));
          return stream;
        }
        
        // Fallback: try to find device by camera index
        if (savedConfig && typeof savedConfig.index_or_path === "number") {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === "videoinput");
          
          if (videoDevices[savedConfig.index_or_path]) {
            const constraints: MediaStreamConstraints = {
              video: {
                deviceId: { exact: videoDevices[savedConfig.index_or_path].deviceId },
                width: { ideal: cameraConfig.width, min: 320, max: 1920 },
                height: { ideal: cameraConfig.height, min: 240, max: 1080 },
                frameRate: { ideal: cameraConfig.fps || 30, min: 10, max: 60 },
              },
            };
            console.log("🔧 Using deviceId by index for saved camera:", videoDevices[savedConfig.index_or_path].deviceId);
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setCameraStreams((prev) => new Map(prev.set(cameraConfig.id, stream)));
            return stream;
          }
        }
      }

      // For new cameras, use normal device ID
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: cameraConfig.width, min: 320, max: 1920 },
          height: { ideal: cameraConfig.height, min: 240, max: 1080 },
          frameRate: { ideal: cameraConfig.fps || 30, min: 10, max: 60 },
        },
      };

      // Only add deviceId if it's not a fallback or backend prefixed
      if (cameraConfig.device_id && 
          !cameraConfig.device_id.startsWith("fallback_") && 
          !cameraConfig.device_id.startsWith("backend_") &&
          !cameraConfig.device_id.startsWith("saved_")) {
        (constraints.video as MediaTrackConstraints).deviceId = {
          exact: cameraConfig.device_id,
        };
        console.log("🔧 Using EXACT deviceId constraint:", cameraConfig.device_id);
      } else {
        console.log("⚠️ No valid deviceId, will use default camera");
      }

      console.log("📋 Final constraints:", JSON.stringify(constraints, null, 2));

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Get the actual device being used
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log("✅ Actual camera settings:", {
          deviceId: settings.deviceId,
          label: videoTrack.label,
          width: settings.width,
          height: settings.height,
        });
      }

      console.log("Camera stream created successfully for:", cameraConfig.name);

      setCameraStreams((prev) => {
        const newMap = new Map(prev.set(cameraConfig.id, stream));
        console.log("Updated camera streams map:", Array.from(newMap.keys()));
        return newMap;
      });

      // Force a small delay to ensure state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      return stream;
    } catch (error: unknown) {
      console.error("Error starting camera preview:", error);

      const isMediaError = error instanceof Error;
      const errorName = isMediaError ? error.name : "";
      const errorMessage = isMediaError ? error.message : "Unknown error";

      // If constraints failed, try with basic constraints
      if (errorName === "OverconstrainedError" || errorName === "NotReadableError") {
        try {
          console.log("Retrying with basic constraints...");
          const basicStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
          });

          setCameraStreams((prev) => new Map(prev.set(cameraConfig.id, basicStream)));
          toast({
            title: "Camera Preview Started",
            description: `${cameraConfig.name} started with basic settings due to constraint issues.`,
          });
          return basicStream;
        } catch (basicError) {
          console.error("Error with basic constraints:", basicError);
        }
      }

      toast({
        title: "Camera Preview Failed",
        description: `Could not start preview for ${cameraConfig.name}: ${errorMessage}`,
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

  // Function to find the actual system camera index for a given device ID
  const findSystemIndexForDeviceId = async (deviceId: string): Promise<number> => {
    try {
      console.log("🔍 Finding system index for device ID:", deviceId);
      
      // Get all video devices and find the index of our device
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      
      console.log("📋 All video devices found:", videoDevices.map((d, i) => ({
        index: i,
        deviceId: d.deviceId,
        label: d.label
      })));
      
      const deviceIndex = videoDevices.findIndex(device => device.deviceId === deviceId);
      
      if (deviceIndex !== -1) {
        console.log(`✅ Device ID ${deviceId} mapped to system index ${deviceIndex}`);
        
        // Test that this mapping is correct by trying to open the camera
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } }
          });
          testStream.getTracks().forEach(track => track.stop());
          console.log(`✅ Verified: Device ID ${deviceId} works at index ${deviceIndex}`);
        } catch (testError) {
          console.warn(`⚠️ Device ID ${deviceId} failed verification:`, testError);
        }
        
        return deviceIndex;
      }
      
      console.warn(`⚠️ Could not find system index for device ID: ${deviceId}`);
      return -1;
    } catch (error) {
      console.error("Error finding system index for device ID:", error);
      return -1;
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
    const selectedCamera = availableCameras.find((cam) => cam.index === cameraIndex);

    if (!selectedCamera) {
      toast({
        title: "Invalid Camera",
        description: "Selected camera is not available.",
        variant: "destructive",
      });
      return;
    }

    // Check if camera is already added
    if (cameras.some((cam) => cam.camera_index === cameraIndex)) {
      toast({
        title: "Camera Already Added",
        description: "This camera is already in the configuration.",
        variant: "destructive",
      });
      return;
    }

    // Map device_id to actual system index for backend compatibility
    const systemIndex = await findSystemIndexForDeviceId(selectedCamera.deviceId);
    
    const newCamera: CameraConfig = {
      id: `camera_${Date.now()}`,
      name: cameraName.trim(), // Simple user name
      type: "browser", // Use browser type
      camera_index: systemIndex !== -1 ? systemIndex : selectedCamera.index, // Use mapped system index
      device_id: selectedCamera.deviceId, // Keep device_id for frontend preview
      width: 640,
      height: 480,
      fps: 30,
    };

    console.log("🆕 Creating new camera config:", {
      name: newCamera.name,
      camera_index: newCamera.camera_index,
      device_id: newCamera.device_id,
      systemIndex: systemIndex,
      selectedCamera: selectedCamera,
    });

    // Save camera configuration to backend
    try {
      const configResponse = await fetchWithHeaders(`${baseUrl}/cameras/create-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_info: {
            id: newCamera.camera_index,
            name: newCamera.name,
            type: newCamera.type,
          },
          custom_settings: {
            width: newCamera.width,
            height: newCamera.height,
            fps: newCamera.fps,
            device_id: newCamera.device_id, // Only device_id, no complex mapping
          }
        }),
      });

      const configResult = await configResponse.json();
      
      if (configResult.status === "success") {
        // Simple config with just device_id
        const configWithDeviceId = {
          ...configResult.camera_config,
          device_id: newCamera.device_id,
          type: "browser" // Mark as browser type for streaming
        };
        
        // Save to camera config
        const saveResponse = await fetchWithHeaders(`${baseUrl}/cameras/config/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camera_name: newCamera.name,
            camera_config: configWithDeviceId
          }),
        });

        const saveResult = await saveResponse.json();
        
        if (saveResult.status === "success") {
          console.log("Camera configuration saved successfully with device_id:", newCamera.device_id);
          
          // Update local saved configs
          setSavedCameraConfigs(prev => ({
            ...prev,
            [newCamera.name]: configWithDeviceId
          }));
        } else {
          console.error("Error saving camera config:", saveResult.message);
        }
      }
    } catch (error) {
      console.error("Error saving camera configuration:", error);
      // Continue even if save fails
    }

    const updatedCameras = [...cameras, newCamera];
    onCamerasChange(updatedCameras);

    // Start preview for the new camera
    await startCameraPreview(newCamera);

    // Reset form
    setSelectedCameraIndex("");
    setCameraName("");

    toast({
      title: "Camera Added",
      description: `${newCamera.name} has been added to the configuration.`,
    });
  };

  const removeCamera = async (cameraId: string) => {
    const camera = cameras.find(cam => cam.id === cameraId);
    
    if (camera) {
      // Remove from backend - check if camera exists in saved configs
      if (camera.device_id.startsWith("saved_") || savedCameraConfigs[camera.name]) {
        try {
          console.log(`Removing camera "${camera.name}" from backend...`);
          const response = await fetchWithHeaders(`${baseUrl}/cameras/config/${encodeURIComponent(camera.name)}`, {
            method: "DELETE",
          });
          
          const result = await response.json();
          
          if (result.status === "success") {
            console.log(`✅ Camera "${camera.name}" removed from backend successfully`);
            
            // Update local saved configs
            setSavedCameraConfigs(prev => {
              const newConfig = { ...prev };
              delete newConfig[camera.name];
              console.log("🗑️ Updated local saved configs after removal:", newConfig);
              return newConfig;
            });
          } else {
            console.error("❌ Error removing camera from backend:", result.message);
          }
        } catch (error) {
          console.error("Error removing camera from backend:", error);
        }
      } else {
        console.log(`Camera "${camera.name}" is not saved in backend, removing only from local state`);
      }
    }
    
    stopCameraPreview(cameraId);
    const updatedCameras = cameras.filter((cam) => cam.id !== cameraId);
    onCamerasChange(updatedCameras);

    toast({
      title: "Camera Removed",
      description: "Camera has been removed from the configuration.",
    });
  };

  const updateCamera = (cameraId: string, updates: Partial<CameraConfig>) => {
    const updatedCameras = cameras.map((cam) =>
      cam.id === cameraId ? { ...cam, ...updates } : cam
    );
    onCamerasChange(updatedCameras);
  };

  // Function to release all camera streams (for recording start)
  const releaseAllCameraStreams = useCallback(() => {
    console.log("🔓 Releasing all camera streams for recording...");
    cameraStreams.forEach((stream, cameraId) => {
      console.log(`🔓 Stopping stream for camera: ${cameraId}`);
      stream.getTracks().forEach((track) => track.stop());
    });
    setCameraStreams(new Map());
    console.log("✅ All camera streams released");
  }, [cameraStreams]);

  // Expose the release function to parent component via ref
  useEffect(() => {
    if (releaseStreamsRef) {
      releaseStreamsRef.current = releaseAllCameraStreams;
    }
  }, [releaseStreamsRef, releaseAllCameraStreams]);

  // Clean up streams on component unmount
  useEffect(() => {
    return () => {
      cameraStreams.forEach((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
          Camera Configuration
        </h3>
        <div className="flex gap-2">
          <Button
            onClick={fetchAvailableCameras}
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
          
          <Button
            onClick={async () => {
              try {
                console.log("🔍 DEBUG: Testing camera mapping...");
                
                // Request permissions first
                try {
                  const permStream = await navigator.mediaDevices.getUserMedia({ video: true });
                  permStream.getTracks().forEach(track => track.stop());
                  console.log("✅ Camera permissions granted");
                } catch (permError) {
                  console.error("❌ Camera permissions denied:", permError);
                  toast({
                    title: "Debug Failed",
                    description: "Camera permissions required for debug",
                    variant: "destructive",
                  });
                  return;
                }
                
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === "videoinput");
                console.log("📋 All video devices:", videoDevices.map((d, i) => ({
                  index: i,
                  deviceId: d.deviceId,
                  label: d.label
                })));
                
                // Test each device
                for (let i = 0; i < videoDevices.length; i++) {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                      video: { deviceId: { exact: videoDevices[i].deviceId } }
                    });
                    console.log(`✅ Index ${i} (${videoDevices[i].label}) - Device ID: ${videoDevices[i].deviceId}`);
                    stream.getTracks().forEach(track => track.stop());
                  } catch (error) {
                    console.log(`❌ Index ${i} (${videoDevices[i].label}) - FAILED:`, error);
                  }
                }
                
                toast({
                  title: "Debug Complete",
                  description: "Check console for camera mapping details",
                });
              } catch (error) {
                console.error("Debug failed:", error);
                toast({
                  title: "Debug Failed",
                  description: "Error during camera debug",
                  variant: "destructive",
                });
              }
            }}
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-400 hover:bg-gray-600 hover:text-white"
          >
            Debug
          </Button>
        </div>
      </div>

      {/* Add Camera Section */}
      {availableCameras.length > 0 && (
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
                  <SelectValue
                    placeholder={
                      isLoadingCameras ? "Loading cameras..." : "Select camera"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {availableCameras.map((camera) => (
                    <SelectItem
                      key={camera.index}
                      value={camera.index.toString()}
                      className="text-white hover:bg-gray-700"
                      disabled={
                        !camera.available ||
                        cameras.some((cam) => cam.camera_index === camera.index)
                      }
                    >
                      {camera.name} (Index {camera.index})
                      {cameras.some((cam) => cam.camera_index === camera.index) &&
                        " (Already added)"}
                    </SelectItem>
                  ))}
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

      {/* Configured Cameras */}
      {cameras.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-300">
            Configured Cameras ({cameras.length})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {cameras.map((camera) => (
              <CameraPreview
                key={camera.id}
                camera={camera}
                stream={cameraStreams.get(camera.id)}
                onRemove={() => removeCamera(camera.id)}
                onUpdate={(updates) => updateCamera(camera.id, updates)}
                onStartPreview={() => startCameraPreview(camera)}
              />
            ))}
          </div>
        </div>
      )}

      {cameras.length === 0 && !isLoadingCameras && (
        <div className="text-center py-8 text-gray-500">
          <Camera className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p>No cameras configured.</p>
          <p className="text-sm">Click "Refresh Cameras" to detect available cameras and add them.</p>
        </div>
      )}
    </div>
  );
};

interface CameraPreviewProps {
  camera: CameraConfig;
  stream?: MediaStream;
  onRemove: () => void;
  onUpdate: (updates: Partial<CameraConfig>) => void;
  onStartPreview: () => void;
}

const CameraPreview: React.FC<CameraPreviewProps> = ({
  camera,
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
      console.log("Setting stream to video element for camera:", camera.name);
      video.srcObject = stream;

      const playVideo = async () => {
        try {
          await video.play();
          console.log("Video playing successfully for camera:", camera.name);
          setIsPreviewActive(true);
        } catch (error) {
          console.error("Error playing video for camera:", camera.name, error);
          video.muted = true;
          try {
            await video.play();
            console.log("Video playing muted for camera:", camera.name);
            setIsPreviewActive(true);
          } catch (mutedError) {
            console.error("Error playing muted video:", mutedError);
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
      console.log("No stream or video element for camera:", camera.name);
      setIsPreviewActive(false);
    }
  }, [stream, camera.name]);

  useEffect(() => {
    // Auto-start preview when camera is added
    if (!stream && !isPreviewActive) {
      console.log("Auto-starting preview for camera:", camera.name);
      onStartPreview();
    }
  }, [stream, isPreviewActive, onStartPreview, camera.name]);

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
            {camera.name.split('_')[0]} {/* Show only the user-given name part */}
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
                value={camera.width}
                onChange={(e) =>
                  onUpdate({ width: parseInt(e.target.value) || 640 })
                }
                className="bg-gray-800 border-gray-700 text-white text-xs h-6 px-2 w-16"
                min="320"
                max="1920"
              />
              <span className="flex items-center">×</span>
              <Input
                type="number"
                value={camera.height}
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
              value={camera.fps || 30}
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
          Type: {camera.type} | Index: {camera.camera_index}
        </div>
      </div>
    </div>
  );
};

export default CameraConfiguration;