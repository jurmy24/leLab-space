import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";

interface Camera {
  id: string | number;
  name: string;
  type: string;
  backend_api?: string;
  preview_image?: string; // Auto-captured preview from backend
  default_stream_profile?: {
    width: number;
    height: number;
    fps: number;
    format?: string;
  };
  available_resolutions?: Array<{
    width: number;
    height: number;
  }>;
}

interface CameraDetectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCameraSelected?: (cameraConfig: any) => void;
}

const CameraDetectionModal: React.FC<CameraDetectionModalProps> = ({
  open,
  onOpenChange,
  onCameraSelected,
}) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const [isDetecting, setIsDetecting] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [capturingCamera, setCapturingCamera] = useState<string | null>(null);
  const [cameraImages, setCameraImages] = useState<{[key: string]: string}>({});

  // Camera configuration settings
  const [cameraName, setCameraName] = useState("");
  const [selectedWidth, setSelectedWidth] = useState<number>(640);
  const [selectedHeight, setSelectedHeight] = useState<number>(480);
  const [selectedFps, setSelectedFps] = useState<number>(30);

  const detectCameras = async (cameraType?: string) => {
    setIsDetecting(true);
    try {
      const url = cameraType 
        ? `${baseUrl}/cameras/detect?camera_type=${cameraType}`
        : `${baseUrl}/cameras/detect`;
        
      const response = await fetchWithHeaders(url);
      const data = await response.json();
      
      if (data.status === "success") {
        setCameras(data.cameras || []);
      } else {
        console.error("Error detecting cameras:", data.message);
        setCameras([]);
      }
    } catch (error) {
      console.error("Error detecting cameras:", error);
      setCameras([]);
    } finally {
      setIsDetecting(false);
    }
  };

  const captureImage = async (camera: Camera) => {
    const cameraKey = `${camera.type}_${camera.id}`;
    setCapturingCamera(cameraKey);
    
    try {
      const response = await fetchWithHeaders(`${baseUrl}/cameras/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ camera_info: camera }),
      });
      
      const result = await response.json();
      if (result.status === "success" && result.image_data) {
        setCameraImages(prev => ({
          ...prev,
          [cameraKey]: result.image_data
        }));
      }
    } catch (error) {
      console.error("Error capturing image:", error);
    } finally {
      setCapturingCamera(null);
    }
  };

  const handleCameraSelect = (camera: Camera) => {
    setSelectedCamera(camera);
    setCameraName(camera.name || `Camera_${camera.id}`);
    
    // Set default resolution from camera info
    if (camera.default_stream_profile) {
      setSelectedWidth(camera.default_stream_profile.width);
      setSelectedHeight(camera.default_stream_profile.height);
      setSelectedFps(camera.default_stream_profile.fps);
    }
  };

  const handleSaveCamera = async () => {
    if (!selectedCamera || !cameraName.trim()) {
      return;
    }

    try {
      // Create camera configuration
      const response = await fetchWithHeaders(`${baseUrl}/cameras/create-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          camera_info: selectedCamera,
          custom_settings: {
            width: selectedWidth,
            height: selectedHeight,
            fps: selectedFps,
          }
        }),
      });

      const result = await response.json();
      
      if (result.status === "success") {
        // Save to camera config
        const saveResponse = await fetchWithHeaders(`${baseUrl}/cameras/config/update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            camera_name: cameraName,
            camera_config: result.camera_config
          }),
        });

        const saveResult = await saveResponse.json();
        
        if (saveResult.status === "success") {
          if (onCameraSelected) {
            onCameraSelected({
              name: cameraName,
              config: result.camera_config
            });
          }
          onOpenChange(false);
        } else {
          console.error("Error saving camera config:", saveResult.message);
        }
      } else {
        console.error("Error creating camera config:", result.message);
      }
    } catch (error) {
      console.error("Error handling camera save:", error);
    }
  };

  const getAvailableResolutions = (camera: Camera) => {
    if (camera.available_resolutions && camera.available_resolutions.length > 0) {
      return camera.available_resolutions;
    }
    
    // Fallback to common resolutions
    return [
      { width: 320, height: 240 },
      { width: 640, height: 480 },
      { width: 800, height: 600 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ];
  };

  const getCameraPreview = (camera: Camera) => {
    const cameraKey = `${camera.type}_${camera.id}`;
    const capturedImage = cameraImages[cameraKey];
    const autoPreview = (camera as any).preview_image; // Preview from detection
    
    if (capturingCamera === cameraKey) {
      return (
        <div className="w-16 h-12 bg-blue-500 rounded flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        </div>
      );
    }
    
    // Use captured image first, then auto preview, then placeholder
    const imageData = capturedImage || autoPreview;
    if (imageData) {
      return (
        <img
          src={`data:image/jpeg;base64,${imageData}`}
          alt="Camera preview"
          className="w-16 h-12 object-cover rounded border border-gray-600"
        />
      );
    }
    
    return (
      <div className="w-16 h-12 bg-gray-700 rounded flex items-center justify-center">
        <Camera className="w-4 h-4 text-gray-400" />
      </div>
    );
  };

  useEffect(() => {
    if (open) {
      detectCameras();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Camera Detection & Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Detection Controls */}
          <div className="flex gap-2">
            <Button
              onClick={() => detectCameras()}
              disabled={isDetecting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isDetecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Detect All Cameras
            </Button>
            <Button
              onClick={() => detectCameras("opencv")}
              disabled={isDetecting}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              OpenCV Only
            </Button>
            <Button
              onClick={() => detectCameras("realsense")}
              disabled={isDetecting}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              RealSense Only
            </Button>
          </div>

          {/* Camera List */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-white">
              Detected Cameras ({cameras.length})
            </h3>
            
            {cameras.length === 0 && !isDetecting && (
              <div className="text-gray-400 text-center py-8">
                No cameras detected. Click "Detect Cameras" to scan for available cameras.
              </div>
            )}

            {cameras.map((camera) => {
              const isSelected = selectedCamera?.id === camera.id && selectedCamera?.type === camera.type;
              
              return (
                <div
                  key={`${camera.type}_${camera.id}`}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 hover:border-gray-600 bg-gray-800"
                  }`}
                  onClick={() => handleCameraSelect(camera)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getCameraPreview(camera)}
                      <div>
                        <h4 className="text-white font-medium">{camera.name}</h4>
                        <div className="text-sm text-gray-400">
                          ID: {camera.id} | Type: {camera.type}
                          {camera.backend_api && ` | Backend: ${camera.backend_api}`}
                        </div>
                        {camera.default_stream_profile && (
                          <div className="text-sm text-gray-400">
                            {camera.default_stream_profile.width}x{camera.default_stream_profile.height} @ {camera.default_stream_profile.fps}fps
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        captureImage(camera);
                      }}
                      disabled={capturingCamera === `${camera.type}_${camera.id}`}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      {capturingCamera === `${camera.type}_${camera.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Refresh"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Camera Configuration */}
          {selectedCamera && (
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-white mb-4">Configure Selected Camera</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cameraName" className="text-sm font-medium text-gray-300">
                    Camera Name
                  </Label>
                  <Input
                    id="cameraName"
                    value={cameraName}
                    onChange={(e) => setCameraName(e.target.value)}
                    placeholder="Enter camera name"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="resolution" className="text-sm font-medium text-gray-300">
                    Resolution
                  </Label>
                  <Select
                    value={`${selectedWidth}x${selectedHeight}`}
                    onValueChange={(value) => {
                      const [width, height] = value.split('x').map(Number);
                      setSelectedWidth(width);
                      setSelectedHeight(height);
                    }}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {getAvailableResolutions(selectedCamera).map((res) => (
                        <SelectItem
                          key={`${res.width}x${res.height}`}
                          value={`${res.width}x${res.height}`}
                          className="text-white hover:bg-gray-700"
                        >
                          {res.width} x {res.height}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fps" className="text-sm font-medium text-gray-300">
                    Frame Rate (FPS)
                  </Label>
                  <Select
                    value={selectedFps.toString()}
                    onValueChange={(value) => setSelectedFps(Number(value))}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {[15, 24, 30, 60].map((fps) => (
                        <SelectItem
                          key={fps}
                          value={fps.toString()}
                          className="text-white hover:bg-gray-700"
                        >
                          {fps} FPS
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCamera}
                  disabled={!cameraName.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Save Camera
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraDetectionModal;