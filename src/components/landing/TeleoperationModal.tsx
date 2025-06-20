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
import { Settings } from "lucide-react";
import PortDetectionModal from "@/components/ui/PortDetectionModal";
import PortDetectionButton from "@/components/ui/PortDetectionButton";
import CameraDetectionModal from "@/components/ui/CameraDetectionModal";
import CameraDetectionButton from "@/components/ui/CameraDetectionButton";
import { useApi } from "@/contexts/ApiContext";
import { useAutoSave } from "@/hooks/useAutoSave";

interface TeleoperationModalProps {
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
  isLoadingConfigs: boolean;
  onStart: () => void;
}

const TeleoperationModal: React.FC<TeleoperationModalProps> = ({
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
  isLoadingConfigs,
  onStart,
}) => {
  const { baseUrl, fetchWithHeaders } = useApi();
  const { debouncedSavePort, debouncedSaveConfig } = useAutoSave();
  const [showPortDetection, setShowPortDetection] = useState(false);
  const [detectionRobotType, setDetectionRobotType] = useState<
    "leader" | "follower"
  >("leader");
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

  const handleRemoveCamera = async (cameraName: string) => {
    try {
      const response = await fetchWithHeaders(`${baseUrl}/cameras/config/${encodeURIComponent(cameraName)}`, {
        method: "DELETE",
      });
      
      const result = await response.json();
      
      if (result.status === "success") {
        setCameraConfig(prev => {
          const newConfig = { ...prev };
          delete newConfig[cameraName];
          return newConfig;
        });
        console.log(`Camera "${cameraName}" removed successfully`);
      } else {
        console.error("Error removing camera:", result.message);
      }
    } catch (error) {
      console.error("Error removing camera:", error);
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-8">
        <DialogHeader>
          <div className="flex justify-center items-center gap-4 mb-4">
            <Settings className="w-8 h-8 text-yellow-500" />
          </div>
          <DialogTitle className="text-white text-center text-2xl font-bold">
            Configure Teleoperation
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <DialogDescription className="text-gray-400 text-base leading-relaxed text-center">
            Configure the robot arm ports and calibration settings for
            teleoperation.
          </DialogDescription>

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="leaderPort"
                className="text-sm font-medium text-gray-300"
              >
                Leader Port
              </Label>
              <div className="flex gap-2">
                <Input
                  id="leaderPort"
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
                htmlFor="leaderConfig"
                className="text-sm font-medium text-gray-300"
              >
                Leader Calibration Config
              </Label>
              <Select value={leaderConfig} onValueChange={handleLeaderConfigChange}>
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
                htmlFor="followerPort"
                className="text-sm font-medium text-gray-300"
              >
                Follower Port
              </Label>
              <div className="flex gap-2">
                <Input
                  id="followerPort"
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
                htmlFor="followerConfig"
                className="text-sm font-medium text-gray-300"
              >
                Follower Calibration Config
              </Label>
              <Select value={followerConfig} onValueChange={handleFollowerConfigChange}>
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

          <div className="space-y-4 border-t border-gray-700 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex-1">
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
                      onClick={() => handleRemoveCamera(name)}
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

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              onClick={onStart}
              className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-white px-10 py-6 text-lg transition-all shadow-md shadow-yellow-500/30 hover:shadow-lg hover:shadow-yellow-500/40"
              disabled={isLoadingConfigs}
            >
              Start Teleoperation
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

      <PortDetectionModal
        open={showPortDetection}
        onOpenChange={setShowPortDetection}
        robotType={detectionRobotType}
        onPortDetected={handlePortDetected}
      />

      <CameraDetectionModal
        open={showCameraDetection}
        onOpenChange={setShowCameraDetection}
        onCameraSelected={handleCameraSelected}
      />
    </Dialog>
  );
};

export default TeleoperationModal;