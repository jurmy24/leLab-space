// WebRTC unified camera system types

export interface WebRTCConfiguration {
  iceServers: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  bundlePolicy?: RTCBundlePolicy;
}

export interface UnifiedCameraSource {
  id: string;                           // device_id for local, peer_id for remote
  type: 'local' | 'remote';
  name: string;                         // user-given name
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Local camera specific
  deviceId?: string;                    // Browser device ID
  
  // Remote camera specific  
  peerId?: string;                      // Remote peer identifier
  
  // Stream configuration
  width: number;
  height: number;
  fps: number;
  
  // Metadata
  lastSeen: string;
  errorCount: number;
  qualityStats?: RTCStatsReport;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'camera-list' | 'camera-request' | 'error' | 'create-session';
  sourceId: string;                     // Camera source ID
  targetId?: string;                    // Target peer (for remote)
  payload: any;                         // Message-specific data
  timestamp: number;
}

export interface CameraOfferMessage extends SignalingMessage {
  type: 'offer';
  payload: {
    sdp: RTCSessionDescriptionInit;
    cameraInfo: {
      name: string;
      width: number;
      height: number;
      fps: number;
    };
  };
}

export interface CameraAnswerMessage extends SignalingMessage {
  type: 'answer';
  payload: {
    sdp: RTCSessionDescriptionInit;
  };
}

export interface ICECandidateMessage extends SignalingMessage {
  type: 'ice-candidate';
  payload: {
    candidate: RTCIceCandidateInit;
  };
}

export interface CameraListMessage extends SignalingMessage {
  type: 'camera-list';
  payload: {
    cameras: Array<{
      id: string;
      name: string;
      type: 'local' | 'remote';
      available: boolean;
    }>;
  };
}

export interface WebRTCManagerEvents {
  'camera-added': (source: UnifiedCameraSource) => void;
  'camera-removed': (sourceId: string) => void;
  'camera-connected': (sourceId: string, stream: MediaStream) => void;
  'camera-disconnected': (sourceId: string) => void;
  'camera-error': (sourceId: string, error: Error) => void;
  'camera-updated': (sourceId: string, updatedSource: UnifiedCameraSource) => void;
  'stats-updated': (sourceId: string, stats: RTCStatsReport) => void;
  'connected': () => void;
  'disconnected': () => void;
}

export interface WebRTCManagerConfig {
  signalingUrl: string;                 // WebSocket signaling server
  rtcConfiguration: WebRTCConfiguration;
  autoReconnect: boolean;
  statsInterval: number;               // Stats collection interval (ms)
  maxReconnectAttempts: number;
}

// Default WebRTC configuration
export const DEFAULT_RTC_CONFIG: WebRTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers here if needed for production
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'balanced'
};

// Camera constraints for different quality levels
export const CAMERA_CONSTRAINTS = {
  low: { width: 320, height: 240, fps: 15 },
  medium: { width: 640, height: 480, fps: 30 },
  high: { width: 1280, height: 720, fps: 30 },
  ultra: { width: 1920, height: 1080, fps: 30 }
} as const;

export type CameraQuality = keyof typeof CAMERA_CONSTRAINTS;