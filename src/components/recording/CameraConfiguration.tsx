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
import { Camera, Plus, X, Video, VideoOff, Smartphone } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";
import { useToast } from "@/hooks/use-toast";
import { useNetworkAddress } from "@/hooks/useNetworkAddress";
import { QRCodeDisplay } from "@/components/ui/QRCodeDisplay";
import io from "socket.io-client";

export interface CameraConfig {
  id: string;
  name: string;
  type: string;
  camera_index?: number; // Keep for backend compatibility
  device_id: string; // Use this for actual camera selection
  width: number;
  height: number;
  fps?: number;
  session_id?: string; // For phone cameras - used to generate QR code URLs
}

interface CameraConfigurationProps {
  cameras: CameraConfig[];
  onCamerasChange: (cameras: CameraConfig[]) => void;
  releaseStreamsRef?: React.MutableRefObject<(() => void) | null>; // Ref to expose stream release function
}

interface PhoneStreamData {
  streamId: string;
  frameData: string;
  timestamp: number;
  isActive: boolean;
}

interface AvailableCamera {
  index: number;
  deviceId: string;
  name: string;
  available: boolean;
  isPhone?: boolean; // Special flag for phone cameras
}

const CameraConfiguration: React.FC<CameraConfigurationProps> = ({
  cameras,
  onCamerasChange,
  releaseStreamsRef,
}) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const { toast } = useToast();
  const networkAddress = useNetworkAddress();

  const [availableCameras, setAvailableCameras] = useState<AvailableCamera[]>(
    []
  );
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<string>("");
  const [cameraName, setCameraName] = useState("");
  const [isLoadingCameras, setIsLoadingCameras] = useState(false);
  const [cameraStreams, setCameraStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const [phoneStreams, setPhoneStreams] = useState<
    Map<string, PhoneStreamData>
  >(new Map());
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  // Fetch available cameras on component mount
  useEffect(() => {
    fetchAvailableCameras();
    setupPhoneStreamConnection();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Log network address detection results for testing
  useEffect(() => {
    if (!networkAddress.loading) {
      console.log("🌐 Network Address Detection Results:");
      console.log("  📍 Address for QR codes:", networkAddress.address);
      console.log("  🏠 Is localhost:", networkAddress.isLocalhost);
      console.log("  📶 Local network IP:", networkAddress.localNetworkIP);
      console.log("  ❌ Error:", networkAddress.error);

      if (networkAddress.isLocalhost && networkAddress.localNetworkIP) {
        console.log("✅ Phone access URL ready:", networkAddress.address);
      } else if (networkAddress.isLocalhost && !networkAddress.localNetworkIP) {
        console.warn(
          "⚠️ Localhost detected but no network IP found. QR codes will use localhost."
        );
      } else {
        console.log("🌐 Using current domain/IP for phone access.");
      }
    }
  }, [networkAddress]);

  const setupPhoneStreamConnection = () => {
    const hostname = window.location.hostname;
    const serverUrl = `http://${hostname}:8000`;

    console.log("📱 Setting up phone stream connection to:", serverUrl);

    socketRef.current = io(serverUrl, {
      transports: ["polling"],
      timeout: 15000,
      forceNew: true,
      upgrade: false,
    });

    socketRef.current.on("connect", () => {
      console.log("📱 Connected to WebRTC backend for phone streams");
    });

    socketRef.current.on("disconnect", () => {
      console.log("📱 Disconnected from WebRTC backend");
    });

    // Listen for phone stream frames
    socketRef.current.on(
      "stream-frame",
      (data: {
        webrtcId: string;
        streamId: string;
        frameData: string;
        timestamp: number;
      }) => {
        console.log("📹 Received phone stream frame for:", data.webrtcId);

        setPhoneStreams((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.webrtcId, {
            streamId: data.streamId,
            frameData: data.frameData,
            timestamp: data.timestamp,
            isActive: true,
          });
          return newMap;
        });
      }
    );

    // Listen for stream status updates
    socketRef.current.on(
      "stream-started",
      (data: { webrtcId: string; streamId: string; metadata: object }) => {
        console.log("📹 Phone stream started:", data.webrtcId);
        toast({
          title: "Phone Camera Connected",
          description: `Stream from ${data.webrtcId} is now active`,
        });
      }
    );

    socketRef.current.on("phone-connected", (data: { webrtcId: string }) => {
      console.log("📱 Phone connected to session:", data.webrtcId);
      toast({
        title: "Phone Connected",
        description: `Phone joined session ${data.webrtcId}`,
      });
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("📱 Phone stream connection error:", error);
    });
  };

  const fetchAvailableCameras = async () => {
    console.log("🚀 fetchAvailableCameras() called");
    setIsLoadingCameras(true);
    try {
      console.log(
        "📡 Trying backend endpoint:",
        `${baseUrl}/available-cameras`
      );
      const response = await fetchWithHeaders(`${baseUrl}/available-cameras`);
      console.log("📡 Backend response status:", response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log("📡 Backend camera data received:", data);

        // Add phone camera to backend data and set it
        const backendCameras = data.cameras || [];
        const phoneCamera: AvailableCamera = {
          index: -1, // Special index for phone cameras
          deviceId: "phone",
          name: "Phone",
          available: true,
          isPhone: true,
        };
        console.log("📱 Adding special Phone camera option to backend cameras");
        setAvailableCameras([...backendCameras, phoneCamera]);

        // Always also try browser detection to get device IDs
        console.log("🔄 Also running browser detection for device IDs...");
        await detectBrowserCameras();
      } else {
        console.log("📡 Backend failed, falling back to browser detection");
        // Fallback to browser camera detection
        await detectBrowserCameras();
      }
    } catch (error) {
      console.error("📡 Error fetching cameras from backend:", error);
      console.log("🔄 Falling back to browser detection due to error");
      // Fallback to browser camera detection
      await detectBrowserCameras();
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
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        console.log("✅ Camera permission granted, stopping temp stream");
        tempStream.getTracks().forEach((track) => track.stop());
      } catch (permError) {
        console.warn(
          "⚠️ Camera permission denied, device IDs may be empty:",
          permError
        );
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      console.log(
        "🔍 Raw video devices from enumerateDevices:",
        videoDevices.map((d) => ({
          deviceId: d.deviceId,
          label: d.label,
          kind: d.kind,
        }))
      );

      const detectedCameras = videoDevices.map((device, index) => ({
        index,
        deviceId: device.deviceId || `fallback_${index}`, // Fallback if deviceId is empty
        name: device.label || `Camera ${index + 1}`,
        available: true,
      }));

      // Always add the special "Phone" camera option at the end
      const phoneCamera: AvailableCamera = {
        index: -1, // Special index for phone cameras
        deviceId: "phone",
        name: "Phone",
        available: true,
        isPhone: true,
      };

      console.log("🎬 Browser cameras with indices mapped:", detectedCameras);
      console.log("📱 Adding special Phone camera option");
      setAvailableCameras([...detectedCameras, phoneCamera]);
    } catch (error) {
      console.error("Error detecting browser cameras:", error);
      // Even if camera detection fails, still add the Phone option
      const phoneCamera: AvailableCamera = {
        index: -1,
        deviceId: "phone",
        name: "Phone",
        available: true,
        isPhone: true,
      };
      setAvailableCameras([phoneCamera]);
      toast({
        title: "Camera Detection Failed",
        description:
          "Could not detect available cameras. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const createPhoneSession = (cameraConfig: CameraConfig) => {
    if (!socketRef.current || cameraConfig.type !== "phone") {
      console.warn(
        "Cannot create phone session - socket not connected or not phone camera"
      );
      return;
    }

    console.log(
      "📱 Creating phone session for:",
      cameraConfig.name,
      cameraConfig.device_id
    );

    // Emit create session event to backend
    socketRef.current.emit("create_session", {
      webrtcId: cameraConfig.device_id,
    });

    toast({
      title: "Phone Session Created",
      description: `Waiting for phone to connect to ${cameraConfig.name}`,
    });
  };

  const startCameraPreview = async (cameraConfig: CameraConfig) => {
    // Phone cameras don't have real device streams
    if (cameraConfig.type === "phone") {
      console.log(
        "📱 Phone camera detected, skipping preview:",
        cameraConfig.name
      );
      toast({
        title: "Phone Camera Added",
        description: `${cameraConfig.name} is ready. Use the remote camera interface to connect.`,
      });
      return null;
    }

    try {
      console.log(
        "🎥 Starting camera preview for:",
        cameraConfig.name,
        "with device_id:",
        cameraConfig.device_id,
        "camera_index:",
        cameraConfig.camera_index
      );

      // Create constraints with fallbacks to avoid OverconstrainedError
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: cameraConfig.width, min: 320, max: 1920 },
          height: { ideal: cameraConfig.height, min: 240, max: 1080 },
          frameRate: { ideal: cameraConfig.fps || 30, min: 10, max: 60 },
        },
      };

      // Only add deviceId if it's not a fallback or phone device
      if (
        cameraConfig.device_id &&
        !cameraConfig.device_id.startsWith("fallback_") &&
        !cameraConfig.device_id.startsWith("phone_")
      ) {
        (constraints.video as MediaTrackConstraints).deviceId = {
          exact: cameraConfig.device_id, // Changed from 'ideal' to 'exact'
        };
        console.log(
          "🔧 Using EXACT deviceId constraint:",
          cameraConfig.device_id
        );
      } else {
        console.log("⚠️ No valid deviceId, will use default camera");
      }

      console.log(
        "📋 Final constraints:",
        JSON.stringify(constraints, null, 2)
      );

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

        // Check if we got the camera we requested
        if (
          cameraConfig.device_id &&
          settings.deviceId !== cameraConfig.device_id
        ) {
          console.warn(
            "⚠️ CAMERA MISMATCH! Requested:",
            cameraConfig.device_id,
            "Got:",
            settings.deviceId
          );
        } else {
          console.log("✅ Camera match confirmed!");
        }
      }

      console.log(
        "Camera stream created successfully for:",
        cameraConfig.name,
        {
          streamId: stream.id,
          tracks: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          active: stream.active,
        }
      );

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
      if (
        errorName === "OverconstrainedError" ||
        errorName === "NotReadableError"
      ) {
        try {
          console.log("Retrying with basic constraints...");
          const basicStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
          });

          setCameraStreams(
            (prev) => new Map(prev.set(cameraConfig.id, basicStream))
          );
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
    const selectedCamera = availableCameras.find(
      (cam) => cam.index === cameraIndex
    );

    if (!selectedCamera) {
      toast({
        title: "Invalid Camera",
        description: "Selected camera is not available.",
        variant: "destructive",
      });
      return;
    }

    // Check if camera is already added (skip for phone cameras as they can be added multiple times)
    if (
      !selectedCamera.isPhone &&
      cameras.some((cam) => cam.camera_index === cameraIndex)
    ) {
      toast({
        title: "Camera Already Added",
        description: "This camera is already in the configuration.",
        variant: "destructive",
      });
      return;
    }

    // Generate unique session ID for phone cameras
    const sessionId = selectedCamera.isPhone
      ? `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : undefined;

    const newCamera: CameraConfig = {
      id: `camera_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: cameraName.trim(),
      type: selectedCamera.isPhone ? "phone" : "opencv",
      camera_index: selectedCamera.isPhone ? undefined : selectedCamera.index,
      device_id: selectedCamera.isPhone
        ? `phone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : selectedCamera.deviceId,
      width: 640,
      height: 480,
      fps: 30,
      session_id: sessionId,
    };

    console.log("🆕 Creating new camera config:", {
      name: newCamera.name,
      type: newCamera.type,
      camera_index: newCamera.camera_index,
      device_id: newCamera.device_id,
      selectedCamera: selectedCamera,
      isPhone: selectedCamera.isPhone,
    });

    const updatedCameras = [...cameras, newCamera];
    onCamerasChange(updatedCameras);

    // For phone cameras, create WebRTC session instead of preview
    if (selectedCamera.isPhone) {
      createPhoneSession(newCamera);
    } else {
      await startCameraPreview(newCamera);
    }

    // Reset form
    setSelectedCameraIndex("");
    setCameraName("");

    toast({
      title: "Camera Added",
      description: `${newCamera.name} has been added to the configuration.`,
    });
  };

  const removeCamera = (cameraId: string) => {
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
      <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
        Camera Configuration
      </h3>

      {/* Network Address Info */}
      {!networkAddress.loading && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-400 font-medium">
              📱 Phone Access URL:
            </span>
            <code className="bg-gray-800 px-2 py-1 rounded text-blue-300">
              {networkAddress.address}
            </code>
            {networkAddress.isLocalhost && networkAddress.localNetworkIP && (
              <span className="text-green-400 text-xs">
                (Network IP detected)
              </span>
            )}
            {networkAddress.isLocalhost && !networkAddress.localNetworkIP && (
              <span className="text-orange-400 text-xs">(Using localhost)</span>
            )}
          </div>
          {networkAddress.error && (
            <div className="text-orange-400 text-xs mt-1">
              Note: {networkAddress.error}
            </div>
          )}
        </div>
      )}

      {/* Add Camera Section */}
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
                    key={
                      camera.isPhone ? `phone-${camera.index}` : camera.index
                    }
                    value={camera.index.toString()}
                    className="text-white hover:bg-gray-700"
                    disabled={
                      !camera.available ||
                      (!camera.isPhone &&
                        cameras.some(
                          (cam) => cam.camera_index === camera.index
                        ))
                    }
                  >
                    {camera.isPhone ? (
                      <>📱 {camera.name} (Remote Camera)</>
                    ) : (
                      <>
                        {camera.name} (Index {camera.index})
                        {cameras.some(
                          (cam) => cam.camera_index === camera.index
                        ) && " (Already added)"}
                      </>
                    )}
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
                phoneStream={phoneStreams.get(camera.device_id)}
                onRemove={() => removeCamera(camera.id)}
                onUpdate={(updates) => updateCamera(camera.id, updates)}
                onStartPreview={() => startCameraPreview(camera)}
              />
            ))}
          </div>
        </div>
      )}

      {cameras.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Camera className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p>No cameras configured. Add a camera to get started.</p>
        </div>
      )}
    </div>
  );
};

interface CameraPreviewProps {
  camera: CameraConfig;
  stream?: MediaStream;
  phoneStream?: PhoneStreamData;
  onRemove: () => void;
  onUpdate: (updates: Partial<CameraConfig>) => void;
  onStartPreview: () => void;
}

const CameraPreview: React.FC<CameraPreviewProps> = ({
  camera,
  stream,
  phoneStream,
  onRemove,
  onUpdate,
  onStartPreview,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const networkAddress = useNetworkAddress();

  // Generate QR code URL for phone cameras
  const generatePhoneUrl = (camera: CameraConfig) => {
    if (camera.type !== "phone" || !camera.session_id) return "";

    const baseUrl =
      networkAddress.address ||
      `${window.location.protocol}//${window.location.host}`;
    const webrtcId = camera.device_id;
    return `${baseUrl}/remote_cam/${camera.session_id}?webrtcId=${webrtcId}`;
  };

  // Debug logging for props
  console.log("CameraPreview render for:", camera.name, {
    hasStream: !!stream,
    streamActive: stream?.active,
    isPreviewActive,
    streamId: stream?.id,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      console.log("Setting stream to video element for camera:", camera.name);
      video.srcObject = stream;

      // Explicitly play the video to ensure it starts
      const playVideo = async () => {
        try {
          await video.play();
          console.log("Video playing successfully for camera:", camera.name);
          setIsPreviewActive(true);
        } catch (error) {
          console.error("Error playing video for camera:", camera.name, error);
          // Try to play without audio in case autoplay is blocked
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

      // Wait for metadata to load before playing
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
    // Auto-start preview when camera is added (but not for phone cameras)
    if (!stream && !isPreviewActive && camera.type !== "phone") {
      console.log("Auto-starting preview for camera:", camera.name);
      onStartPreview();
    }
  }, [stream, isPreviewActive, onStartPreview, camera.name, camera.type]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Camera Preview */}
      <div className="aspect-[4/3] bg-gray-800 relative">
        {camera.type === "phone" ? (
          /* Phone Camera - Show Stream if Active, Otherwise QR Code */
          <div className="w-full h-full relative bg-gradient-to-br from-blue-900/20 to-purple-900/20">
            {phoneStream && phoneStream.isActive ? (
              /* Live Phone Stream */
              <>
                <img
                  src={phoneStream.frameData}
                  alt="Phone Camera Stream"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2">
                  <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded text-xs">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400">LIVE</span>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                  📱 Phone Stream
                </div>
              </>
            ) : (
              /* QR Code Display */
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                {camera.session_id ? (
                  <QRCodeDisplay
                    url={generatePhoneUrl(camera)}
                    size={140}
                    title="Scan with Phone"
                    showControls={false}
                    showUrl={false}
                    className="scale-90"
                  />
                ) : (
                  <div className="text-center">
                    <Smartphone className="w-12 h-12 text-blue-400 mb-3 mx-auto" />
                    <span className="text-blue-400 text-sm font-medium">
                      Phone Camera
                    </span>
                    <span className="text-gray-400 text-xs mt-1 block">
                      Generating QR code...
                    </span>
                  </div>
                )}

                <div className="absolute top-2 left-2">
                  <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-blue-400">WAITING</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : stream ? (
          /* Regular Camera Stream */
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() =>
                console.log("Video metadata loaded for:", camera.name)
              }
              onPlay={() =>
                console.log("Video started playing for:", camera.name)
              }
              onError={(e) => console.error("Video error for:", camera.name, e)}
              onCanPlay={() => console.log("Video can play for:", camera.name)}
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
          /* No Stream Available */
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
          <h5 className="font-medium text-white truncate">{camera.name}</h5>
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
          Type: {camera.type} |{" "}
          {camera.type === "phone" && camera.session_id ? (
            <>Session: {camera.session_id.substring(0, 12)}...</>
          ) : (
            <>Device: {camera.device_id?.substring(0, 10)}...</>
          )}
        </div>

        {/* Phone Camera URL Display */}
        {camera.type === "phone" && camera.session_id && (
          <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
            <span className="text-gray-400">Phone URL:</span>
            <div className="text-blue-400 font-mono text-xs break-all mt-1">
              {generatePhoneUrl(camera)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraConfiguration;
