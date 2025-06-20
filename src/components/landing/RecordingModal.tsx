import React, { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QrCode } from "lucide-react";
import PortDetectionModal from "@/components/ui/PortDetectionModal";
import PortDetectionButton from "@/components/ui/PortDetectionButton";
import CameraDetectionModal from "@/components/ui/CameraDetectionModal";
import CameraDetectionButton from "@/components/ui/CameraDetectionButton";
import QrCodeModal from "@/components/recording/QrCodeModal";
import { useApi } from "@/contexts/ApiContext";
import { useAutoSave } from "@/hooks/useAutoSave";
interface RecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderPort: string;
  setLeaderPort: (value: string) => void;
  followerPort: string;
  setFollowerPort: (value: string) => void;
  leaderConfig: string;
  setLeaderConfig: (value: string) => void;
  followerConfig: string;
  setFollowerConfig: (value: string) => void;
  leaderConfigs: string[];
  followerConfigs: string[];
  datasetRepoId: string;
  setDatasetRepoId: (value: string) => void;
  singleTask: string;
  setSingleTask: (value: string) => void;
  numEpisodes: number;
  setNumEpisodes: (value: number) => void;
  isLoadingConfigs: boolean;
  onStart: () => void;
}
const RecordingModal: React.FC<RecordingModalProps> = ({
  open,
  onOpenChange,
  leaderPort,
  setLeaderPort,
  followerPort,
  setFollowerPort,
  leaderConfig,
  setLeaderConfig,
  followerConfig,
  setFollowerConfig,
  leaderConfigs,
  followerConfigs,
  datasetRepoId,
  setDatasetRepoId,
  singleTask,
  setSingleTask,
  numEpisodes,
  setNumEpisodes,
  isLoadingConfigs,
  onStart,
}) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const { debouncedSavePort, debouncedSaveConfig } = useAutoSave();
  const [showPortDetection, setShowPortDetection] = useState(false);
  const [detectionRobotType, setDetectionRobotType] = useState<
    "leader" | "follower"
  >("leader");
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [showCameraDetection, setShowCameraDetection] = useState(false);
  const [cameraConfig, setCameraConfig] = useState<any>({});

  const handlePortDetection = (robotType: "leader" | "follower") => {
    setDetectionRobotType(robotType);
    setShowPortDetection(true);
  };
  const handlePortDetected = (port: string) => {
    if (detectionRobotType === "leader") {
      setLeaderPort(port);
    } else {
      setFollowerPort(port);
    }
  };

  // Enhanced port change handlers that save automatically
  const handleLeaderPortChange = (value: string) => {
    setLeaderPort(value);
    // Auto-save with debouncing to avoid excessive API calls
    debouncedSavePort("leader", value);
  };

  const handleFollowerPortChange = (value: string) => {
    setFollowerPort(value);
    // Auto-save with debouncing to avoid excessive API calls
    debouncedSavePort("follower", value);
  };

  // Enhanced config change handlers that save automatically
  const handleLeaderConfigChange = (value: string) => {
    setLeaderConfig(value);
    // Auto-save with debouncing to avoid excessive API calls
    debouncedSaveConfig("leader", value);
  };

  const handleFollowerConfigChange = (value: string) => {
    setFollowerConfig(value);
    // Auto-save with debouncing to avoid excessive API calls
    debouncedSaveConfig("follower", value);
  };
  // Load saved ports and configurations on component mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        // Load leader port
        const leaderResponse = await fetchWithHeaders(
          `${baseUrl}/robot-port/leader`
        );
        const leaderData = await leaderResponse.json();
        if (leaderData.status === "success" && leaderData.default_port) {
          setLeaderPort(leaderData.default_port);
        }

        // Load follower port
        const followerResponse = await fetchWithHeaders(
          `${baseUrl}/robot-port/follower`
        );
        const followerData = await followerResponse.json();
        if (followerData.status === "success" && followerData.default_port) {
          setFollowerPort(followerData.default_port);
        }

        // Load leader configuration
        const leaderConfigResponse = await fetchWithHeaders(
          `${baseUrl}/robot-config/leader?available_configs=${leaderConfigs.join(',')}`
        );
        const leaderConfigData = await leaderConfigResponse.json();
        if (leaderConfigData.status === "success" && leaderConfigData.default_config) {
          setLeaderConfig(leaderConfigData.default_config);
        }

        // Load follower configuration
        const followerConfigResponse = await fetchWithHeaders(
          `${baseUrl}/robot-config/follower?available_configs=${followerConfigs.join(',')}`
        );
        const followerConfigData = await followerConfigResponse.json();
        if (followerConfigData.status === "success" && followerConfigData.default_config) {
          setFollowerConfig(followerConfigData.default_config);
        }

        // Load camera configuration
        await loadCameraConfig();
      } catch (error) {
        console.error("Error loading saved data:", error);
      }
    };

    if (open && leaderConfigs.length > 0 && followerConfigs.length > 0) {
      loadSavedData();
    }
  }, [open, setLeaderPort, setFollowerPort, setLeaderConfig, setFollowerConfig, leaderConfigs, followerConfigs, baseUrl, fetchWithHeaders]);

  const handleQrCodeClick = () => {
    // Generate a session ID for this recording session
    const newSessionId = `recording_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    setSessionId(newSessionId);
    setShowQrCodeModal(true);
  };

  const handleCameraSelected = (cameraData: any) => {
    setCameraConfig(prev => ({
      ...prev,
      [cameraData.name]: cameraData.config
    }));
  };

  const loadCameraConfig = async () => {
    try {
      const response = await fetchWithHeaders(`${baseUrl}/cameras/config`);
      const data = await response.json();
      
      if (data.status === "success" && data.camera_config) {
        setCameraConfig(data.camera_config.cameras || {});
      }
    } catch (error) {
      console.error("Error loading camera config:", error);
    }
  };
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[600px] p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-center items-center mb-4">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">REC</span>
              </div>
            </div>
            <DialogTitle className="text-white text-center text-2xl font-bold">
              Configure Recording
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <DialogDescription className="text-gray-400 text-base leading-relaxed text-center">
              Configure the robot arm settings and dataset parameters for
              recording.
            </DialogDescription>

            <div className="border-y border-gray-700 py-6 flex flex-col items-center gap-4 bg-gray-800/50 rounded-lg">
              <h3 className="text-lg font-semibold text-white">
                Need an extra angle?
              </h3>
              <p className="text-sm text-gray-400 -mt-2">
                Add your phone as a secondary camera.
              </p>
              <Button
                onClick={handleQrCodeClick}
                title="Add Phone Camera"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:scale-105 rounded-lg"
              >
                <QrCode className="w-5 h-5" />
                <span>Add Phone Camera</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
                  Robot Configuration
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="recordLeaderPort"
                      className="text-sm font-medium text-gray-300"
                    >
                      Leader Port
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="recordLeaderPort"
                        value={leaderPort}
                        onChange={(e) => handleLeaderPortChange(e.target.value)}
                        placeholder="/dev/tty.usbmodem5A460816421"
                        className="bg-gray-800 border-gray-700 text-white flex-1"
                      />
                      <PortDetectionButton
                        onClick={() => handlePortDetection("leader")}
                        robotType="leader"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="recordLeaderConfig"
                      className="text-sm font-medium text-gray-300"
                    >
                      Leader Calibration Config
                    </Label>
                    <Select
                      value={leaderConfig}
                      onValueChange={handleLeaderConfigChange}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue
                          placeholder={
                            isLoadingConfigs
                              ? "Loading configs..."
                              : "Select leader config"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {leaderConfigs.map((config) => (
                          <SelectItem
                            key={config}
                            value={config}
                            className="text-white hover:bg-gray-700"
                          >
                            {config}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="recordFollowerPort"
                      className="text-sm font-medium text-gray-300"
                    >
                      Follower Port
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="recordFollowerPort"
                        value={followerPort}
                        onChange={(e) => handleFollowerPortChange(e.target.value)}
                        placeholder="/dev/tty.usbmodem5A460816621"
                        className="bg-gray-800 border-gray-700 text-white flex-1"
                      />
                      <PortDetectionButton
                        onClick={() => handlePortDetection("follower")}
                        robotType="follower"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="recordFollowerConfig"
                      className="text-sm font-medium text-gray-300"
                    >
                      Follower Calibration Config
                    </Label>
                    <Select
                      value={followerConfig}
                      onValueChange={handleFollowerConfigChange}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue
                          placeholder={
                            isLoadingConfigs
                              ? "Loading configs..."
                              : "Select follower config"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {followerConfigs.map((config) => (
                          <SelectItem
                            key={config}
                            value={config}
                            className="text-white hover:bg-gray-700"
                          >
                            {config}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Camera Configuration Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2 flex-1">
                    Camera Configuration
                  </h3>
                  <CameraDetectionButton
                    onClick={() => setShowCameraDetection(true)}
                  />
                </div>
                
                {Object.keys(cameraConfig).length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400 mb-2">
                      Configured Cameras ({Object.keys(cameraConfig).length})
                    </div>
                    {Object.entries(cameraConfig).map(([name, config]: [string, any]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700"
                      >
                        <div>
                          <div className="text-white font-medium">{name}</div>
                          <div className="text-xs text-gray-400">
                            {config.type} - {config.width}x{config.height} @ {config.fps}fps
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Remove camera from config
                            setCameraConfig(prev => {
                              const newConfig = { ...prev };
                              delete newConfig[name];
                              return newConfig;
                            });
                          }}
                          className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm italic">
                    No cameras configured. Click the camera icon to detect and configure cameras.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
                  Dataset Configuration
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="datasetRepoId"
                      className="text-sm font-medium text-gray-300"
                    >
                      Dataset Repository ID *
                    </Label>
                    <Input
                      id="datasetRepoId"
                      value={datasetRepoId}
                      onChange={(e) => setDatasetRepoId(e.target.value)}
                      placeholder="username/dataset_name"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="singleTask"
                      className="text-sm font-medium text-gray-300"
                    >
                      Task Name *
                    </Label>
                    <Input
                      id="singleTask"
                      value={singleTask}
                      onChange={(e) => setSingleTask(e.target.value)}
                      placeholder="e.g., pick_and_place"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="numEpisodes"
                      className="text-sm font-medium text-gray-300"
                    >
                      Number of Episodes
                    </Label>
                    <Input
                      id="numEpisodes"
                      type="number"
                      min="1"
                      max="100"
                      value={numEpisodes}
                      onChange={(e) => setNumEpisodes(parseInt(e.target.value))}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                onClick={onStart}
                className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white px-10 py-6 text-lg transition-all shadow-md shadow-red-500/30 hover:shadow-lg hover:shadow-red-500/40"
                disabled={isLoadingConfigs}
              >
                Start Recording
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="w-full sm:w-auto border-gray-500 hover:border-gray-200 px-10 py-6 text-lg text-zinc-500 bg-zinc-900 hover:bg-zinc-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PortDetectionModal
        open={showPortDetection}
        onOpenChange={setShowPortDetection}
        robotType={detectionRobotType}
        onPortDetected={handlePortDetected}
      />

      <QrCodeModal
        open={showQrCodeModal}
        onOpenChange={setShowQrCodeModal}
        sessionId={sessionId}
      />

      <CameraDetectionModal
        open={showCameraDetection}
        onOpenChange={setShowCameraDetection}
        onCameraSelected={handleCameraSelected}
      />
    </>
  );
};
export default RecordingModal;