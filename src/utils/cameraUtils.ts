// Robust camera management utilities
import { CameraConfig } from "@/components/recording/CameraConfiguration";

export interface RobustCameraConfig {
  // Stable identifiers
  hash: string;              // Unique hash based on device_id + name
  device_id: string;         // Stable hardware identifier
  user_name: string;         // User-given name
  
  // Configuration
  width: number;
  height: number;
  fps: number;
  
  // Metadata (auto-updated)
  last_detected_index?: number;    // Last detected index (can change)
  last_seen: string;              // Timestamp of last detection
  is_available: boolean;          // Currently available
}

/**
 * Create a stable hash from device_id and user name
 * This hash will be the primary identifier for camera configs
 */
export const createCameraHash = (deviceId: string, userName: string): string => {
  // Create a stable hash using device_id + user_name
  const combined = `${deviceId}|${userName}`;
  
  // Simple but stable hash implementation
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to base36 for shorter, readable string
  return Math.abs(hash).toString(36).padStart(8, '0');
};

/**
 * Convert legacy CameraConfig to robust format
 */
export const convertToRobustConfig = (legacyConfig: CameraConfig): RobustCameraConfig => {
  const hash = createCameraHash(legacyConfig.device_id, legacyConfig.name);
  
  return {
    hash,
    device_id: legacyConfig.device_id,
    user_name: legacyConfig.name,
    width: legacyConfig.width,
    height: legacyConfig.height,
    fps: legacyConfig.fps || 30,
    last_detected_index: legacyConfig.camera_index,
    last_seen: new Date().toISOString(),
    is_available: true,
  };
};

/**
 * Convert robust config back to legacy format for compatibility
 */
export const convertFromRobustConfig = (robustConfig: RobustCameraConfig): CameraConfig => {
  return {
    id: robustConfig.hash,
    name: robustConfig.user_name,
    type: "browser",
    camera_index: robustConfig.last_detected_index || 0,
    device_id: robustConfig.device_id,
    width: robustConfig.width,
    height: robustConfig.height,
    fps: robustConfig.fps,
  };
};

/**
 * Validate if a camera config is still valid by checking device availability
 */
export const validateCameraConfig = async (config: RobustCameraConfig): Promise<boolean> => {
  try {
    // Check if device_id still exists in browser
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === "videoinput");
    
    return videoDevices.some(device => device.deviceId === config.device_id);
  } catch (error) {
    console.error("Error validating camera config:", error);
    return false;
  }
};

/**
 * Find current device index for a device_id
 */
export const findCurrentDeviceIndex = async (deviceId: string): Promise<number> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === "videoinput");
    
    const index = videoDevices.findIndex(device => device.deviceId === deviceId);
    return index;
  } catch (error) {
    console.error("Error finding device index:", error);
    return -1;
  }
};

/**
 * Clean up camera configs - mark unavailable ones
 */
export const cleanupCameraConfigs = async (configs: RobustCameraConfig[]): Promise<RobustCameraConfig[]> => {
  const cleanedConfigs = [];
  
  for (const config of configs) {
    const isValid = await validateCameraConfig(config);
    const currentIndex = await findCurrentDeviceIndex(config.device_id);
    
    cleanedConfigs.push({
      ...config,
      is_available: isValid,
      last_detected_index: currentIndex !== -1 ? currentIndex : config.last_detected_index,
      last_seen: isValid ? new Date().toISOString() : config.last_seen,
    });
  }
  
  return cleanedConfigs;
};

/**
 * Get display name for camera (consistent between preview and streaming)
 */
export const getCameraDisplayName = (config: RobustCameraConfig): string => {
  return config.user_name;
};

/**
 * Get camera streaming identifier (consistent between preview and streaming)
 */
export const getCameraStreamingId = (config: RobustCameraConfig): string => {
  // Use hash as consistent identifier for both preview and streaming
  return config.hash;
};

/**
 * Sort cameras consistently (by user name, alphabetical)
 */
export const sortCamerasConsistently = (cameras: RobustCameraConfig[]): RobustCameraConfig[] => {
  return cameras.sort((a, b) => a.user_name.localeCompare(b.user_name));
};