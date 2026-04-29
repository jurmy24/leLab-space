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
import { 
  Camera, 
  Plus, 
  X, 
  Video, 
  VideoOff, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Activity,
  Smartphone,
  QrCode,
  Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { webRTCManager } from "@/utils/webrtc/WebRTCManager";
import { UnifiedCameraSource, CameraQuality, CAMERA_CONSTRAINTS } from "@/types/webrtc";
import { useApi } from "@/contexts/ApiContext";
import NgrokConfigModal from "@/components/landing/NgrokConfigModal";

// Legacy interface for compatibility  
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

interface WebRTCCameraConfigurationProps {
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

const WebRTCCameraConfiguration: React.FC<WebRTCCameraConfigurationProps> = ({
  cameras,
  onCamerasChange,
  releaseStreamsRef,
  loadSavedCameras = true,
}) => {
  const { baseUrl, fetchWithHeaders, isNgrokEnabled } = useApi();
  const { toast } = useToast();

  // WebRTC state
  const [webrtcSources, setWebrtcSources] = useState<UnifiedCameraSource[]>([]);
  const [isConnectedToSignaling, setIsConnectedToSignaling] = useState(false);
  const [signalingStats, setSignalingStats] = useState<any>(null);

  // Camera detection state
  const [detectedCameras, setDetectedCameras] = useState<DetectedCamera[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<string>("");
  const [cameraName, setCameraName] = useState("");
  const [isLoadingCameras, setIsLoadingCameras] = useState(false);
  
  // External camera state
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [externalSessionQrUrls, setExternalSessionQrUrls] = useState<Map<string, string>>(new Map());
  const [reconnectingSessions, setReconnectingSessions] = useState<Set<string>>(new Set());
  
  // Ngrok modal state for external cameras
  const [showNgrokModalForCamera, setShowNgrokModalForCamera] = useState(false);
  const [pendingCameraName, setPendingCameraName] = useState<string>("");

  // WebRTC video elements refs
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // WebRTC event handlers (with useCallback to maintain references)
  const handleCameraAdded = useCallback((source: UnifiedCameraSource) => {
    console.log("📹 Camera added to WebRTC:", source.name);
    setWebrtcSources(prev => [...prev.filter(s => s.id !== source.id), source]);
  }, []);

  const handleCameraRemoved = useCallback((sourceId: string) => {
    console.log("🗑️ Camera removed from WebRTC:", sourceId);
    setWebrtcSources(prev => prev.filter(s => s.id !== sourceId));
    
    // Remove video element ref
    const videoElement = videoRefs.current.get(sourceId);
    if (videoElement) {
      videoElement.srcObject = null;
      videoRefs.current.delete(sourceId);
    }
  }, []);

  const handleCameraConnected = useCallback((sourceId: string, stream: MediaStream) => {
    console.log("✅ Camera connected:", sourceId);
    
    // Update source status
    setWebrtcSources(prev => prev.map(source => 
      source.id === sourceId 
        ? { ...source, status: 'connected', stream }
        : source
    ));

    // Clean up reconnecting state for this session
    const connectedSource = webrtcSources.find(s => s.id === sourceId);
    if (connectedSource?.deviceId) {
      setReconnectingSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectedSource.deviceId!);
        return newSet;
      });
    }

    // Attach stream to video element
    const videoElement = videoRefs.current.get(sourceId);
    if (videoElement && stream) {
      videoElement.srcObject = stream;
      videoElement.play().catch(console.error);
    }
  }, [webrtcSources]);

  const handleCameraDisconnected = useCallback((sourceId: string) => {
    console.log("🔌 Camera disconnected:", sourceId);
    setWebrtcSources(prev => prev.map(source => 
      source.id === sourceId 
        ? { ...source, status: 'disconnected', stream: undefined }
        : source
    ));
  }, []);

  const handleCameraError = useCallback((sourceId: string, error: Error) => {
    console.error("❌ Camera error:", sourceId, error);
    toast({
      title: "Camera Error",
      description: `Error with camera ${sourceId}: ${error.message}`,
      variant: "destructive",
    });
  }, [toast]);

  const handleSessionCreated = useCallback((sessionId: string, qrUrl: string, sessionInfo?: any) => {
    console.log("🌐 Session created with QR URL:", { sessionId, qrUrl, sessionInfo });
    console.log("🌐 Current externalSessionQrUrls before update:", externalSessionQrUrls);
    
    // Always save the QR URL if we have one
    if (qrUrl) {
      setExternalSessionQrUrls(prev => {
        const newMap = new Map(prev.set(sessionId, qrUrl));
        console.log("🌐 Updated externalSessionQrUrls:", newMap);
        return newMap;
      });
    }
    
    // If session existed and device was connected, mark as reconnecting
    if (sessionInfo?.sessionExisted && sessionInfo?.deviceConnected) {
      console.log("🔄 Session existed with connected device - marking as reconnecting");
      setReconnectingSessions(prev => {
        const newSet = new Set(prev.add(sessionId));
        console.log("🔄 Updated reconnectingSessions:", newSet);
        return newSet;
      });
    }
  }, [externalSessionQrUrls]);

  const handleCameraUpdated = useCallback((sourceId: string, updatedSource: UnifiedCameraSource) => {
    console.log("🔄 Camera updated in WebRTC manager:", sourceId);
    setWebrtcSources(prev => prev.map(s => 
      s.id === sourceId ? updatedSource : s
    ));
  }, []);

  // Helper function to request QR URL for cameras that don't have it
  const requestQRUrlForExistingCamera = useCallback(async (deviceId: string, name: string, retryCount = 0) => {
    const maxRetries = 3;
    
    // Check connection state
    if (!webRTCManager.isConnectedToSignaling()) {
      console.log(`❌ Cannot request QR URL for ${deviceId}: not connected to signaling server`);
      
      // If not connected and we have retries left, wait and try again
      if (retryCount < maxRetries) {
        console.log(`⏳ Waiting 3 seconds before retry ${retryCount + 1}/${maxRetries} for ${deviceId}`);
        setTimeout(() => {
          requestQRUrlForExistingCamera(deviceId, name, retryCount + 1);
        }, 3000);
      } else {
        console.log(`❌ Max retries reached for ${deviceId}, giving up`);
      }
      return;
    }
    
    try {
      console.log(`🔄 Checking if session exists for ${deviceId} (attempt ${retryCount + 1})`);
      // Check if session already exists and just needs to be restored
      await webRTCManager.addRemoteCamera(deviceId, name, "medium");
      console.log(`✅ Successfully requested session info for ${deviceId}`);
    } catch (error) {
      console.error(`❌ Failed to request QR URL for ${deviceId}:`, error);
      
      // Retry if we have attempts left
      if (retryCount < maxRetries) {
        console.log(`⏳ Retrying QR URL request for ${deviceId} in 2 seconds...`);
        setTimeout(() => {
          requestQRUrlForExistingCamera(deviceId, name, retryCount + 1);
        }, 2000);
      }
    }
  }, []);

  const fetchSignalingStats = useCallback(async () => {
    try {
      const response = await fetchWithHeaders(`${baseUrl}/webrtc/status`);
      const data = await response.json();
      setSignalingStats(data.stats);
    } catch (error) {
      console.error("Error fetching signaling stats:", error);
    }
  }, [baseUrl, fetchWithHeaders]);

  const handleWebRTCConnected = useCallback(() => {
    console.log("✅ Connected to WebRTC signaling server");
    setIsConnectedToSignaling(true);
    fetchSignalingStats();
    
    // If we have external cameras without QR URLs, try to request them now
    const externalCamerasWithoutQR = webrtcSources.filter(camera => 
      camera.type === 'remote' && 
      (camera.deviceId?.startsWith('external_') || camera.deviceId?.startsWith('phone_')) &&
      camera.deviceId && !externalSessionQrUrls.get(camera.deviceId)
    );
    
    if (externalCamerasWithoutQR.length > 0) {
      console.log(`🔄 Connection established, requesting QR URLs for ${externalCamerasWithoutQR.length} external cameras`);
      setTimeout(() => {
        externalCamerasWithoutQR.forEach(camera => {
          if (camera.deviceId) {
            console.log(`🔄 Requesting QR URL for ${camera.deviceId} after connection`);
            requestQRUrlForExistingCamera(camera.deviceId, camera.name, 0);
          }
        });
      }, 1000);
    }
  }, [fetchSignalingStats, webrtcSources, externalSessionQrUrls, requestQRUrlForExistingCamera]);

  const handleWebRTCDisconnected = useCallback(() => {
    console.log("🔌 Disconnected from WebRTC signaling server");
    setIsConnectedToSignaling(false);
  }, []);

  // Initialize WebRTC Manager
  useEffect(() => {
    const initializeWebRTC = async () => {
      try {
        console.log("🚀 Initializing WebRTC Manager...");
        
        // Configure WebRTC manager
        const signalingUrl = baseUrl.replace('http', 'ws') + '/ws/webrtc';
        console.log('🔧 Configuring WebRTC signaling URL:', signalingUrl);
        console.log('🔧 Base URL:', baseUrl);
        webRTCManager.config.signalingUrl = signalingUrl;
        
        // Setup event listeners
        webRTCManager.on('camera-added', handleCameraAdded);
        webRTCManager.on('camera-removed', handleCameraRemoved);
        webRTCManager.on('camera-connected', handleCameraConnected);
        webRTCManager.on('camera-disconnected', handleCameraDisconnected);
        webRTCManager.on('camera-error', handleCameraError);
        webRTCManager.on('camera-updated', handleCameraUpdated);
        webRTCManager.on('session-created', handleSessionCreated);
        webRTCManager.on('connected', handleWebRTCConnected);
        webRTCManager.on('disconnected', handleWebRTCDisconnected);

        // Connect to signaling server if not already connected
        if (!webRTCManager.isConnectedToSignaling()) {
          console.log("🔗 Connecting to signaling server...");
          await webRTCManager.connect();
          console.log("✅ Successfully connected to signaling server");
        } else {
          console.log("✅ Already connected to signaling server");
          // Set the connected state even if already connected
          setIsConnectedToSignaling(true);
          fetchSignalingStats();
        }
        
        // Wait a bit for connection to stabilize before loading cameras
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Load saved cameras if requested and no cameras exist yet
        if (loadSavedCameras && webRTCManager.getAllCameras().length === 0) {
          console.log("📂 No existing cameras, loading saved configurations...");
          await loadSavedCameraConfigs();
        } else if (loadSavedCameras) {
          console.log("📂 Cameras already exist, skipping saved camera load");
          // Load existing cameras into local state
          const existingCameras = webRTCManager.getAllCameras();
          console.log("📹 Loading existing cameras into state:", existingCameras.length);
          setWebrtcSources([...existingCameras]);
          
          // For existing external cameras, try to restore QR URLs
          const externalCameras = existingCameras.filter(camera => 
            camera.type === 'remote' && 
            (camera.deviceId?.startsWith('external_') || camera.deviceId?.startsWith('phone_'))
          );
          
          if (externalCameras.length > 0) {
            console.log("🔄 Found existing external cameras, requesting QR URLs...");
            setTimeout(() => {
              externalCameras.forEach(camera => {
                if (camera.deviceId && !externalSessionQrUrls.get(camera.deviceId)) {
                  console.log(`🔄 Requesting QR URL for existing camera: ${camera.deviceId}`);
                  requestQRUrlForExistingCamera(camera.deviceId, camera.name);
                }
              });
            }, 2000);
          }
        }
        
    } catch (error) {
        console.error("❌ Failed to initialize WebRTC:", error);
        toast({
          title: "WebRTC Initialization Failed",
          description: "Could not connect to WebRTC signaling server.",
          variant: "destructive",
        });
      }
    };

    initializeWebRTC();

    // Cleanup on unmount
    return () => {
      // Only remove our specific listeners using the function references
      webRTCManager.off('camera-added', handleCameraAdded);
      webRTCManager.off('camera-removed', handleCameraRemoved);
      webRTCManager.off('camera-connected', handleCameraConnected);
      webRTCManager.off('camera-disconnected', handleCameraDisconnected);
      webRTCManager.off('camera-error', handleCameraError);
      webRTCManager.off('camera-updated', handleCameraUpdated);
      webRTCManager.off('session-created', handleSessionCreated);
      
      // Also remove our connection listeners specifically
      webRTCManager.off('connected', handleWebRTCConnected);
      webRTCManager.off('disconnected', handleWebRTCDisconnected);
      
      // Don't disconnect WebRTC manager as teleoperation might need it
    };
  }, [baseUrl, loadSavedCameras, handleCameraAdded, handleCameraRemoved, handleCameraConnected, handleCameraDisconnected, handleCameraError, handleCameraUpdated, handleSessionCreated, handleWebRTCConnected, handleWebRTCDisconnected, requestQRUrlForExistingCamera]);

  // Sync WebRTC sources to parent component
  const syncToParent = useCallback(() => {
    const legacyConfigs: CameraConfig[] = webrtcSources
      .filter(source => source.status === 'connected')
      .map(source => ({
        id: source.id,
        name: source.name,
        type: "webrtc",
        device_id: source.deviceId || source.id,
        width: source.width,
        height: source.height,
        fps: source.fps,
      }));

    console.log("🔄 Syncing WebRTC cameras to parent:", legacyConfigs);
    onCamerasChange(legacyConfigs);
  }, [webrtcSources, onCamerasChange]);

  // Update parent when sources change
  useEffect(() => {
    syncToParent();
  }, [syncToParent]);

  // Camera detection
  const detectAvailableCameras = async () => {
    console.log("🔍 Detecting available cameras...");
    setIsLoadingCameras(true);
    
    try {
      // First enumeration (might show limited devices)
      let devices = await navigator.mediaDevices.enumerateDevices();
      console.log("📹 Initial device enumeration:", devices.filter(d => d.kind === "videoinput"));

      // Request camera permissions to unlock full device list
      const tempStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: "user" } // This helps detect iPhone Continuity cameras
        } 
      });
      tempStream.getTracks().forEach(track => track.stop());

      // Wait a bit for system to register all cameras
      await new Promise(resolve => setTimeout(resolve, 500));

      // Re-enumerate devices after permissions granted
      devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      
      console.log("📹 Final device enumeration:", videoDevices);

      const detected = videoDevices.map((device, index) => ({
        index,
        deviceId: device.deviceId,
        name: device.label || `Camera ${index + 1}`,
        available: true,
      }));

      setDetectedCameras(detected);
      console.log("✅ Detected cameras:", detected);
      
    } catch (error) {
      console.error("❌ Camera detection failed:", error);
      toast({
        title: "Camera Detection Failed",
        description: "Could not detect cameras. Please check permissions.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCameras(false);
    }
  };

  // Add camera to WebRTC system
  const addCamera = async () => {
    // Check if "Add External" option is selected
    if (selectedCameraIndex === "external_phone") {
      await addExternalCamera();
    } else {
      await addLocalCamera();
    }
  };

  // Add local camera
  const addLocalCamera = async () => {
    if (!selectedCameraIndex || !cameraName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a camera and provide a name.",
        variant: "destructive",
      });
      return;
    }

    if (!isConnectedToSignaling) {
      toast({
        title: "Not Connected",
        description: "Not connected to WebRTC signaling server.",
        variant: "destructive",
      });
      return;
    }

    const cameraIndex = parseInt(selectedCameraIndex);
    const selectedCamera = detectedCameras.find(cam => cam.index === cameraIndex);

    if (!selectedCamera) {
      toast({
        title: "Invalid Camera",
        description: "Selected camera is not available.",
        variant: "destructive",
      });
      return;
    }

    // Check if camera already added (check both local state and WebRTC manager)
    const isDuplicateInLocal = webrtcSources.some(source => source.deviceId === selectedCamera.deviceId);
    const isDuplicateInManager = webRTCManager.getAllCameras().some(source => source.deviceId === selectedCamera.deviceId);
    
    if (isDuplicateInLocal || isDuplicateInManager) {
      toast({
        title: "Camera Already Added",
        description: "This camera is already in the configuration.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`🆕 Adding WebRTC local camera: ${cameraName} (${selectedCamera.deviceId})`);
      
      const sourceId = await webRTCManager.addLocalCamera(
        selectedCamera.deviceId,
        cameraName.trim(),
        "medium" // Default quality, user can change it later
      );

      // Save to backend
      await saveCameraToBackend(sourceId, cameraName, selectedCamera.deviceId, "medium");

      // Reset form
      setSelectedCameraIndex("");
      setCameraName("");

      toast({
        title: "Camera Added",
        description: `${cameraName} has been added successfully via WebRTC.`,
      });

    } catch (error) {
      console.error("❌ Failed to add local camera:", error);
      toast({
        title: "Camera Add Failed",
        description: `Could not add camera: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Add external camera
  const addExternalCamera = async () => {
    if (!cameraName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a name for the external camera.",
        variant: "destructive",
      });
      return;
    }

    // Check if ngrok is configured before proceeding
    if (!isNgrokEnabled) {
      console.log("🌐 Ngrok not configured, opening ngrok modal for external camera");
      setPendingCameraName(cameraName);
      setShowNgrokModalForCamera(true);
      return;
    }

    if (!isConnectedToSignaling) {
      toast({
        title: "Not Connected",
        description: "Not connected to WebRTC signaling server.",
        variant: "destructive",
      });
      return;
    }

    await performAddExternalCamera(cameraName);
  };

  // Core logic for adding external camera (can be called from ngrok success callback)
  const performAddExternalCamera = async (camName: string) => {
    setIsGeneratingQR(true);

    try {
      console.log(`🆕 Adding external camera: ${camName}`);
      
      // Generate unique session ID for external camera connection
      const sessionId = `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create a remote camera source
      const sourceId = await webRTCManager.addRemoteCamera(
        sessionId,
        camName.trim(),
        "medium"
      );

      // Save to backend
      await saveCameraToBackend(sourceId, camName, sessionId, "medium");

      // Reset form
      setCameraName("");
      setSelectedCameraIndex("");

      toast({
        title: "External Camera Created",
        description: `${camName} QR code generated. Scan with your device to connect.`,
      });

    } catch (error) {
      console.error("❌ Failed to add external camera:", error);
      toast({
        title: "External Camera Add Failed",
        description: `Could not create external camera: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Handle successful ngrok configuration for camera creation
  const handleNgrokConfiguredForCamera = async () => {
    console.log("✅ Ngrok configured successfully, proceeding with camera creation");
    setShowNgrokModalForCamera(false);
    
    if (pendingCameraName) {
      await performAddExternalCamera(pendingCameraName);
      setPendingCameraName("");
    }
  };

  // Handle ngrok modal cancellation for camera creation
  const handleNgrokCancelledForCamera = () => {
    console.log("❌ Ngrok configuration cancelled, not adding camera");
    setShowNgrokModalForCamera(false);
    setPendingCameraName("");
    // Don't add the camera - user cancelled the required ngrok setup
  };

  // Get local network IP for QR code generation
  const getLocalNetworkIP = async (): Promise<string> => {
    try {
      // Try to get it from the current URL if it's not localhost
      const currentHost = window.location.hostname;
      if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        return currentHost;
      }

      // Otherwise, try to detect local IP (this is a simplified approach)
      // In production, the backend should provide this information
      return currentHost;
    } catch (error) {
      console.error("Failed to get local IP:", error);
      return window.location.hostname;
    }
  };

  // Update camera settings (resolution, FPS)
  const updateCameraSettings = async (sourceId: string, updates: Partial<UnifiedCameraSource>) => {
    const source = webrtcSources.find(s => s.id === sourceId);
    if (!source) {
      console.error("❌ Source not found for update:", sourceId);
      return;
    }

    try {
      console.log(`🔧 Updating camera settings for ${source.name}:`, updates);
      
      // Get new constraints based on updates
      const newWidth = updates.width || source.width;
      const newHeight = updates.height || source.height;
      const newFps = updates.fps || source.fps;
      
      // Get new media stream with updated constraints
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: source.deviceId },
          width: { ideal: newWidth },
          height: { ideal: newHeight },
          frameRate: { ideal: newFps }
        }
      });

      // Stop old stream
      if (source.stream) {
        source.stream.getTracks().forEach(track => track.stop());
      }

      // Update the source in WebRTC manager
      const updatedSource = {
        ...source,
        width: newWidth,
        height: newHeight,
        fps: newFps,
        stream: newStream
      };

      // Update video element first
      const videoElement = videoRefs.current.get(sourceId);
      if (videoElement) {
        videoElement.srcObject = newStream;
        videoElement.play().catch(console.error);
      }

      // Update in WebRTC manager (this will handle peer connection updates)
      await webRTCManager.updateCamera(sourceId, updatedSource);
      
      // Update local state  
      setWebrtcSources(prev => prev.map(s => 
        s.id === sourceId ? updatedSource : s
      ));

      // Save updated config to backend
      const quality = newWidth >= 1280 ? "high" : newWidth >= 640 ? "medium" : "low";
      await saveCameraToBackend(sourceId, source.name, source.deviceId!, quality);

      toast({
        title: "Camera Updated",
        description: `${source.name} settings updated to ${newWidth}x${newHeight} @ ${newFps}fps`,
      });

    } catch (error) {
      console.error("❌ Failed to update camera settings:", error);
      toast({
        title: "Update Failed",
        description: `Could not update camera settings: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Remove camera
  const removeCamera = async (sourceId: string) => {
    const source = webrtcSources.find(s => s.id === sourceId);
    if (!source) return;

    try {
      console.log(`🗑️ Removing WebRTC camera: ${source.name}`);
      
      webRTCManager.removeCamera(sourceId);
      
      // Remove from backend
      await removeCameraFromBackend(source.name);

      toast({
        title: "Camera Removed",
        description: `${source.name} has been removed.`,
      });

    } catch (error) {
      console.error("❌ Failed to remove camera:", error);
      toast({
        title: "Camera Remove Failed",
        description: `Could not remove camera: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Backend integration
  const saveCameraToBackend = async (sourceId: string, name: string, deviceId: string, quality: CameraQuality) => {
    try {
      const constraints = CAMERA_CONSTRAINTS[quality];
      const backendConfig = {
        type: "webrtc",
        device_id: deviceId,
        source_id: sourceId,
        width: constraints.width,
        height: constraints.height,
        fps: constraints.fps,
        quality: quality,
        created_at: new Date().toISOString(),
      };

      const response = await fetchWithHeaders(`${baseUrl}/cameras/config/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_name: name,
          camera_config: backendConfig
        }),
      });

      const result = await response.json();
      if (result.status !== "success") {
        console.error("❌ Backend save failed:", result.message);
      } else {
        console.log("✅ Camera saved to backend:", name);
      }
    } catch (error) {
      console.error("❌ Error saving to backend:", error);
    }
  };

  const removeCameraFromBackend = async (name: string) => {
    try {
      const response = await fetchWithHeaders(`${baseUrl}/cameras/config/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      
      const result = await response.json();
      if (result.status === "success") {
        console.log("✅ Camera removed from backend:", name);
      }
    } catch (error) {
      console.error("❌ Error removing from backend:", error);
    }
  };

  const loadSavedCameraConfigs = async () => {
    try {
      console.log("🔄 Loading saved WebRTC camera configurations...");
      const response = await fetchWithHeaders(`${baseUrl}/cameras/config`);
      const data = await response.json();
      
      if (data.status === "success" && data.camera_config && data.camera_config.cameras) {
        const savedCameras = data.camera_config.cameras;
        console.log("📦 Found saved cameras:", Object.keys(savedCameras));
        
        // Load WebRTC cameras
        for (const [name, config] of Object.entries(savedCameras)) {
          if ((config as any).type === "webrtc" && (config as any).device_id && (config as any).source_id) {
            try {
              const quality = (config as any).quality || "medium";
              const deviceId = (config as any).device_id;
              console.log(`🔄 Restoring WebRTC camera: ${name}`);
              
              // Check if this is an external camera (remote) or local camera  
              if (deviceId.startsWith('external_') || deviceId.startsWith('phone_')) {
                // This is a remote external camera (legacy phone_ prefix supported)
                console.log(`🔄 Restoring external camera: ${name} with deviceId: ${deviceId}`);
                console.log(`🔄 Current externalSessionQrUrls:`, externalSessionQrUrls);
                await webRTCManager.addRemoteCamera(deviceId, name, quality);
                console.log(`🔄 After addRemoteCamera, externalSessionQrUrls:`, externalSessionQrUrls);
                
                // Wait a bit and check if QR URL was received, if not request it again
                setTimeout(() => {
                  if (!externalSessionQrUrls.get(deviceId)) {
                    console.log(`⚠️ QR URL not received for ${deviceId}, requesting again...`);
                    requestQRUrlForExistingCamera(deviceId, name, 0);
                  } else {
                    console.log(`✅ QR URL already available for ${deviceId}`);
                  }
                }, 3000);
              } else {
                // This is a local camera
                await webRTCManager.addLocalCamera(deviceId, name, quality);
              }
            } catch (error) {
              console.error(`❌ Failed to restore camera ${name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Error loading saved cameras:", error);
    }
  };

  // Release all streams function
  const releaseAllStreams = useCallback(() => {
    console.log("🔓 Releasing all WebRTC camera streams...");
    webrtcSources.forEach(source => {
      if (source.stream) {
        source.stream.getTracks().forEach(track => track.stop());
      }
    });
    webRTCManager.disconnect();
  }, [webrtcSources]);

  // Expose release function to parent
  useEffect(() => {
    if (releaseStreamsRef) {
      releaseStreamsRef.current = releaseAllStreams;
    }
  }, [releaseStreamsRef, releaseAllStreams]);

  // Auto-detect cameras on mount
  useEffect(() => {
    detectAvailableCameras();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
          Camera Configuration
        </h3>
        <div className="flex gap-2 items-center">
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
      {(detectedCameras.length > 0 || isConnectedToSignaling) && (
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
                    const isAlreadyAdded = webrtcSources.some(source => source.deviceId === camera.deviceId);
                    return (
                      <SelectItem
                        key={camera.index}
                        value={camera.index.toString()}
                        className="text-white hover:bg-gray-700"
                        disabled={isAlreadyAdded}
                      >
                        {camera.name}
                        {isAlreadyAdded && " (Added)"}
                      </SelectItem>
                    );
                  })}
                  {/* Add External Camera option at the end */}
                  <SelectItem
                    value="external_phone"
                    className="text-white hover:bg-gray-700 border-t border-gray-600 mt-1"
                  >
                    <div className="flex items-center gap-2">
                      
                      Add External
                    </div>
                  </SelectItem>
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
                placeholder={selectedCameraIndex === "external_phone" ? "e.g., external_cam" : "e.g., workspace_cam"}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <Button
                onClick={addCamera}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                disabled={
                  !selectedCameraIndex || 
                  !cameraName.trim() || 
                  !isConnectedToSignaling ||
                  isGeneratingQR ||
                  (selectedCameraIndex !== "external_phone" && detectedCameras.length === 0)
                }
                title={`Debug: selectedCameraIndex=${selectedCameraIndex}, cameraName='${cameraName}', isConnectedToSignaling=${isConnectedToSignaling}, isGeneratingQR=${isGeneratingQR}, detectedCameras=${detectedCameras.length}`}
              >
                {isGeneratingQR ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating QR...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Camera
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* WebRTC Cameras */}
      {webrtcSources.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-300">
            Cameras ({webrtcSources.length})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {webrtcSources.map((source) => (
              <WebRTCCameraPreview
                key={source.id}
                source={source}
                externalSessionQrUrls={externalSessionQrUrls}
                reconnectingSessions={reconnectingSessions}
                onRemove={() => removeCamera(source.id)}
                onUpdateSource={(updates) => {
                  updateCameraSettings(source.id, updates);
                }}
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
        </div>
      )}

      {webrtcSources.length === 0 && !isLoadingCameras && (
        <div className="text-center py-8 text-gray-500">
          <Camera className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p>No cameras configured.</p>
          <p className="text-sm">
            {isConnectedToSignaling 
              ? "Click \"Refresh Cameras\" to detect available cameras and add them."
              : "Connecting..."
            }
          </p>
        </div>
      )}

      {/* Ngrok Configuration Modal for External Cameras */}
      <NgrokConfigModal
        open={showNgrokModalForCamera}
        onOpenChange={(open) => {
          if (!open) {
            handleNgrokCancelledForCamera();
          }
        }}
        onSuccess={handleNgrokConfiguredForCamera}
        isForExternalCamera={true}
      />
    </div>
  );
};

// WebRTC Camera Preview Component
interface WebRTCCameraPreviewProps {
  source: UnifiedCameraSource;
  onRemove: () => void;
  onUpdateSource: (updates: Partial<UnifiedCameraSource>) => void;
  videoRef: (el: HTMLVideoElement | null) => void;
  externalSessionQrUrls?: Map<string, string>;
  reconnectingSessions?: Set<string>;
}

const WebRTCCameraPreview: React.FC<WebRTCCameraPreviewProps> = ({
  source,
  onRemove,
  onUpdateSource,
  videoRef,
  externalSessionQrUrls,
  reconnectingSessions,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [forceShowQR, setForceShowQR] = useState(false);

  // Handle video stream assignment separately to avoid re-renders causing flashing
  useEffect(() => {
    if (localVideoRef.current && source.stream && source.status === 'connected') {
      const videoElement = localVideoRef.current;
      
      // Only set srcObject if it's different from current
      if (videoElement.srcObject !== source.stream) {
        console.log(`🎥 Setting srcObject for ${source.name}`);
        videoElement.srcObject = source.stream;
        videoElement.play().catch(e => {
          // Only log if it's not the "interrupted by new load" error, which is expected
          if (e.name !== 'AbortError') {
            console.error(`Video play error for ${source.name}:`, e);
          }
        });
      }
    } else if (localVideoRef.current && !source.stream) {
      // Clear srcObject if no stream
      localVideoRef.current.srcObject = null;
    }
  }, [source.stream, source.status, source.name]);

  // Reset forceShowQR when camera connects successfully
  useEffect(() => {
    if (source.status === 'connected' && forceShowQR) {
      setForceShowQR(false);
    }
  }, [source.status, forceShowQR]);

  // Check if this is an external camera waiting for connection
  const isExternalCamera = source.type === 'remote' && !source.stream;
  
  // Logic for showing QR vs waiting for reconnection
  const qrUrlValue = externalSessionQrUrls?.get(source.deviceId || '');
  const isReconnecting = reconnectingSessions?.has(source.deviceId || '') || false;
  const hasValidQrUrl = !!qrUrlValue;

  // Auto-trigger ngrok modal if QR is forced but no URL available (ngrok not configured)
  useEffect(() => {
    if (forceShowQR && isExternalCamera && !qrUrlValue) {
      console.log("🌐 QR forced but no URL available - ngrok needs configuration");
      // Reset forceShowQR and trigger ngrok modal
      setForceShowQR(false);
      // Here we could trigger the ngrok modal, but we need access to those functions
      // For now, let's add a note that ngrok needs to be configured
    }
  }, [forceShowQR, isExternalCamera, qrUrlValue]);

  const getStatusColor = () => {
    switch (source.status) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'disconnected': return 'text-red-400';
      case 'error': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (source.status) {
      case 'connected': return <Wifi className="w-3 h-3" />;
      case 'connecting': return <RefreshCw className="w-3 h-3 animate-spin" />;
      case 'disconnected': return <WifiOff className="w-3 h-3" />;
      case 'error': return <X className="w-3 h-3" />;
      default: return <Camera className="w-3 h-3" />;
    }
  };
  
  // Show QR for new external cameras, when forced, or when we have a valid QR URL but device hasn't connected yet
  // Don't show QR only when it's a reconnection scenario (unless forced)
  const shouldShowQR = isExternalCamera && source.status === 'connecting' && (!isReconnecting || forceShowQR);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Camera Preview */}
      <div className="aspect-[4/3] bg-gray-800 relative">
        {source.stream && source.status === 'connected' ? (
          <>
            <video
              ref={(el) => {
                localVideoRef.current = el;
                videoRef(el);
              }}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2">
              <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400">LIVE</span>
              </div>
            </div>
          </>
        ) : shouldShowQR ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <QrCode className="w-16 h-16 text-blue-400 mb-4" />
            <div className="text-center">
              <p className="text-gray-400 text-xs mb-3">Scan QR or access URL from device</p>
              <div className="bg-white p-1 rounded">
                <QRCodePlaceholder 
                  sessionId={source.deviceId || ''} 
                  qrUrl={(() => {
                    const qrUrl = externalSessionQrUrls?.get(source.deviceId || '');
                    console.log(`🔍 Getting QR URL for deviceId '${source.deviceId}' from map:`, qrUrl);
                    console.log(`🔍 Current externalSessionQrUrls keys:`, Array.from(externalSessionQrUrls?.keys() || []));
                    return qrUrl;
                  })()} 
                />
              </div>
              {!qrUrlValue && forceShowQR && (
                <p className="text-xs text-red-400 mt-2">
                  ⚠️ ngrok must be configured to generate QR codes
                </p>
              )}
              {isReconnecting && forceShowQR && (
                <button
                  onClick={() => setForceShowQR(false)}
                  className="text-xs text-gray-500 hover:text-gray-400 underline mt-2"
                >
                  Back to reconnection mode
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {isExternalCamera ? (
              <>
                <Smartphone className="w-8 h-8 text-gray-500 mb-2" />
                <span className="text-gray-500 text-sm">
                  {source.status === 'connecting' ? (
                    isReconnecting ? 'Waiting for device reconnection...' : 'Waiting for device...'
                  ) : 'Device disconnected'}
                </span>
                {isReconnecting && source.status === 'connecting' && !forceShowQR && (
                  <div className="text-xs text-gray-600 mt-1 px-4 text-center">
                    <p>Refresh the camera page on your device to reconnect</p>
                    <button
                      onClick={() => setForceShowQR(true)}
                      className="text-blue-400 hover:text-blue-300 underline mt-1"
                    >
                      or regenerate the QR
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <VideoOff className="w-8 h-8 text-gray-500 mb-2" />
                <span className="text-gray-500 text-sm">
                  {source.status === 'connecting' ? 'Connecting...' : 'No Stream'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Camera Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="font-medium text-white truncate">
            {source.name}
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


        {/* Camera Controls */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">Resolution</Label>
            <Select
              value={`${source.width}x${source.height}`}
              onValueChange={(value) => {
                const [width, height] = value.split('x').map(Number);
                onUpdateSource({ width, height });
              }}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-xs h-6">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="320x240" className="text-white hover:bg-gray-700 text-xs">320x240</SelectItem>
                <SelectItem value="640x480" className="text-white hover:bg-gray-700 text-xs">640x480</SelectItem>
                <SelectItem value="1280x720" className="text-white hover:bg-gray-700 text-xs">1280x720</SelectItem>
                <SelectItem value="1920x1080" className="text-white hover:bg-gray-700 text-xs">1920x1080</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs text-gray-400">FPS</Label>
            <Select
              value={source.fps.toString()}
              onValueChange={(value) => {
                onUpdateSource({ fps: parseInt(value) });
              }}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-xs h-6">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="15" className="text-white hover:bg-gray-700 text-xs">15 fps</SelectItem>
                <SelectItem value="30" className="text-white hover:bg-gray-700 text-xs">30 fps</SelectItem>
                <SelectItem value="60" className="text-white hover:bg-gray-700 text-xs">60 fps</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};

// QR Code Component using qrcode library
interface QRCodePlaceholderProps {
  sessionId: string;
  qrUrl?: string;
}

const QRCodePlaceholder: React.FC<QRCodePlaceholderProps> = ({ sessionId, qrUrl }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  
  console.log(`🔍 QRCodePlaceholder render - sessionId: ${sessionId}, qrUrl: ${qrUrl}`);
  
  // Only use provided URL from ngrok, don't generate local HTTP URLs
  const finalQrUrl = qrUrl;
  
  useEffect(() => {
    const generateQR = async () => {
      try {
        setIsLoading(true);
        if (!finalQrUrl) {
          setQrDataUrl("");
          setIsLoading(false);
          return;
        }
        const QRCode = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(finalQrUrl, {
          width: 128,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateQR();
  }, [finalQrUrl]);
  
  if (isLoading) {
    return (
      <div className="w-24 h-24 bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-600 text-xs p-2 rounded">
        <RefreshCw className="w-8 h-8 mb-2 animate-spin" />
        <p className="text-center">Generating QR...</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center">
      {qrDataUrl ? (
        <img 
          src={qrDataUrl} 
          alt="QR Code for phone camera connection"
          className="w-24 h-24 rounded"
        />
      ) : (
        <div className="w-24 h-24 bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-600 text-xs p-1 rounded">
          <Globe className="w-6 h-6 mb-1" />
          <p className="text-center text-[8px] leading-tight">
            Configure<br/>ngrok first
          </p>
        </div>
      )}
      <p className="text-center mt-2 text-[9px] text-blue-600">
        {qrUrl ? (
          <a href={qrUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {qrUrl.length > 30 ? `${qrUrl.substring(0, 30)}...` : qrUrl}
          </a>
        ) : (
          <span className="text-gray-500 text-[8px]">Requires ngrok URL</span>
        )}
      </p>
    </div>
  );
};

export default WebRTCCameraConfiguration;