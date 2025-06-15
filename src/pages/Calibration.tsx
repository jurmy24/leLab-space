import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Settings,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  Square,
  RefreshCw,
  Trash2,
  List,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";
import PortDetectionButton from "@/components/ui/PortDetectionButton";
import PortDetectionModal from "@/components/ui/PortDetectionModal";
import { useApi } from "@/contexts/ApiContext";

interface CalibrationStatus {
  calibration_active: boolean;
  status: string; // "idle", "connecting", "calibrating", "completed", "error", "stopping"
  device_type: string | null;
  error: string | null;
  message: string;
  console_output: string;
}

interface CalibrationRequest {
  device_type: string; // "robot" or "teleop"
  port: string;
  config_file: string;
}

interface CalibrationConfig {
  name: string;
  filename: string;
  size: number;
  modified: number;
}

// ConfigsResponse interface removed since we're using text input

const Calibration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { baseUrl, fetchWithHeaders } = useApi();

  // Ref for auto-scrolling console
  const consoleRef = useRef<HTMLDivElement>(null);

  // Form state
  const [deviceType, setDeviceType] = useState<string>("robot");
  const [port, setPort] = useState<string>("");
  const [configFile, setConfigFile] = useState<string>("");

  // Config loading and management
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [availableConfigs, setAvailableConfigs] = useState<CalibrationConfig[]>(
    []
  );

  // Port detection state
  const [showPortDetection, setShowPortDetection] = useState(false);
  const [detectionRobotType, setDetectionRobotType] = useState<
    "leader" | "follower"
  >("leader");

  // Calibration state
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus>(
    {
      calibration_active: false,
      status: "idle",
      device_type: null,
      error: null,
      message: "",
      console_output: "",
    }
  );
  const [isPolling, setIsPolling] = useState(false);

  // Config loading removed since we're using text input now

  // Poll calibration status
  const pollStatus = async () => {
    try {
      const response = await fetchWithHeaders(`${baseUrl}/calibration-status`);
      if (response.ok) {
        const status = await response.json();
        setCalibrationStatus(status);

        // Stop polling if calibration is completed or error
        if (
          !status.calibration_active &&
          (status.status === "completed" || status.status === "error")
        ) {
          setIsPolling(false);
        }
      }
    } catch (error) {
      console.error("Error polling status:", error);
    }
  };

  // Start calibration
  const handleStartCalibration = async () => {
    if (!deviceType || !port || !configFile) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const request: CalibrationRequest = {
      device_type: deviceType,
      port: port,
      config_file: configFile,
    };

    try {
      const response = await fetchWithHeaders(`${baseUrl}/start-calibration`, {
        method: "POST",
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Calibration Started",
          description: `Calibration started for ${deviceType}`,
        });
        setIsPolling(true);
      } else {
        toast({
          title: "Calibration Failed",
          description: result.message || "Failed to start calibration",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting calibration:", error);
      toast({
        title: "Error",
        description: "Failed to start calibration",
        variant: "destructive",
      });
    }
  };

  // Stop calibration
  const handleStopCalibration = async () => {
    try {
      const response = await fetchWithHeaders(`${baseUrl}/stop-calibration`, {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Calibration Stopped",
          description: "Calibration has been stopped",
        });
        setIsPolling(false);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to stop calibration",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error stopping calibration:", error);
      toast({
        title: "Error",
        description: "Failed to stop calibration",
        variant: "destructive",
      });
    }
  };

  // Reset form
  const handleReset = () => {
    setDeviceType("robot");
    setPort("");
    setConfigFile("");
    setAvailableConfigs([]);
    setCalibrationStatus({
      calibration_active: false,
      status: "idle",
      device_type: null,
      error: null,
      message: "",
      console_output: "",
    });
    setIsPolling(false);
  };

  // Load available configs for the selected device type
  const loadAvailableConfigs = async (deviceType: string) => {
    if (!deviceType) return;

    setIsLoadingConfigs(true);
    try {
      const response = await fetchWithHeaders(
        `${baseUrl}/calibration-configs/${deviceType}`
      );
      const data = await response.json();

      if (data.success) {
        setAvailableConfigs(data.configs || []);
      } else {
        toast({
          title: "Error Loading Configs",
          description: data.message || "Could not load calibration configs",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error Loading Configs",
        description: "Could not connect to the backend server",
        variant: "destructive",
      });
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  // Delete a config file
  const handleDeleteConfig = async (configName: string) => {
    if (!deviceType) return;

    try {
      const response = await fetchWithHeaders(
        `${baseUrl}/calibration-configs/${deviceType}/${configName}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Config Deleted",
          description: data.message,
        });
        // Reload the configs list
        loadAvailableConfigs(deviceType);
      } else {
        toast({
          title: "Delete Failed",
          description: data.message || "Could not delete the configuration",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not delete the configuration",
        variant: "destructive",
      });
    }
  };

  // Send Enter to calibration process
  const handleSendEnter = async () => {
    if (!calibrationStatus.calibration_active) return;

    console.log("🔵 Enter button clicked - sending input...");

    try {
      const response = await fetchWithHeaders(`${baseUrl}/calibration-input`, {
        method: "POST",
        body: JSON.stringify({ input: "\n" }), // Send actual newline character
      });

      const data = await response.json();
      console.log("🔵 Server response:", data);

      if (data.success) {
        toast({
          title: "Enter Sent",
          description: "Enter key sent to calibration process",
        });
      } else {
        toast({
          title: "Input Failed",
          description: data.message || "Could not send Enter",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("🔴 Error sending Enter:", error);
      toast({
        title: "Error",
        description: "Could not send Enter to calibration",
        variant: "destructive",
      });
    }
  };

  // Config loading removed - using text input instead

  // Set up polling
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPolling) {
      // Use ultra-fast polling during active calibration for real-time updates
      const pollInterval =
        calibrationStatus.status === "calibrating" ? 25 : 100;
      interval = setInterval(pollStatus, pollInterval); // 25ms during calibration, 100ms otherwise
      pollStatus(); // Initial poll
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, calibrationStatus.status]);

  // Load configs when device type changes
  useEffect(() => {
    if (deviceType) {
      loadAvailableConfigs(deviceType);
    } else {
      setAvailableConfigs([]);
    }
  }, [deviceType]);

  // Auto-scroll console to bottom when output changes (with debounce)
  useEffect(() => {
    if (consoleRef.current && calibrationStatus.console_output) {
      // Small delay to ensure DOM is updated before scrolling
      const timeoutId = setTimeout(() => {
        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
      }, 10);

      return () => clearTimeout(timeoutId);
    }
  }, [calibrationStatus.console_output]);

  // Load default port when device type changes
  useEffect(() => {
    const loadDefaultPort = async () => {
      if (!deviceType) return;

      try {
        const robotType = deviceType === "robot" ? "follower" : "leader";
        const response = await fetchWithHeaders(
          `${baseUrl}/robot-port/${robotType}`
        );
        const data = await response.json();
        if (data.status === "success") {
          // Use saved port if available, otherwise use default port
          const portToUse = data.saved_port || data.default_port;
          if (portToUse) {
            setPort(portToUse);
          }
        }
      } catch (error) {
        console.error("Error loading default port:", error);
      }
    };

    loadDefaultPort();
  }, [deviceType]);

  // Handle port detection
  const handlePortDetection = () => {
    const robotType = deviceType === "robot" ? "follower" : "leader";
    setDetectionRobotType(robotType);
    setShowPortDetection(true);
  };

  const handlePortDetected = (detectedPort: string) => {
    setPort(detectedPort);
  };

  // Get status color and icon
  const getStatusDisplay = () => {
    switch (calibrationStatus.status) {
      case "idle":
        return {
          color: "bg-slate-500",
          icon: <Settings className="w-4 h-4" />,
          text: "Idle",
        };
      case "connecting":
        return {
          color: "bg-yellow-500",
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: "Connecting",
        };
      case "calibrating":
        return {
          color: "bg-blue-500",
          icon: <Activity className="w-4 h-4" />,
          text: "Calibrating",
        };
      case "completed":
        return {
          color: "bg-green-500",
          icon: <CheckCircle className="w-4 h-4" />,
          text: "Completed",
        };
      case "error":
        return {
          color: "bg-red-500",
          icon: <XCircle className="w-4 h-4" />,
          text: "Error",
        };
      case "stopping":
        return {
          color: "bg-orange-500",
          icon: <Square className="w-4 h-4" />,
          text: "Stopping",
        };
      default:
        return {
          color: "bg-slate-500",
          icon: <Settings className="w-4 h-4" />,
          text: "Unknown",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Memoize console output to prevent unnecessary re-renders
  const memoizedConsoleOutput = useMemo(() => {
    return (
      calibrationStatus.console_output || "Waiting for calibration output..."
    );
  }, [calibrationStatus.console_output]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Logo iconOnly />
            <h1 className="text-3xl font-bold">Device Calibration</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <Card className="bg-slate-800/60 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-200">
                <Settings className="w-5 h-5 text-blue-400" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Device Type Selection */}
              <div className="space-y-2">
                <Label
                  htmlFor="deviceType"
                  className="text-sm font-medium text-slate-300"
                >
                  Device Type *
                </Label>
                <Select value={deviceType} onValueChange={setDeviceType}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white rounded-md">
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="robot" className="hover:bg-slate-700">
                      Robot (Follower)
                    </SelectItem>
                    <SelectItem value="teleop" className="hover:bg-slate-700">
                      Teleoperator (Leader)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Port Configuration */}
              <div className="space-y-2">
                <Label
                  htmlFor="port"
                  className="text-sm font-medium text-slate-300"
                >
                  Port *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="/dev/tty.usbmodem..."
                    className="bg-slate-700 border-slate-600 text-white rounded-md flex-1"
                  />
                  <PortDetectionButton
                    onClick={handlePortDetection}
                    robotType={deviceType === "robot" ? "follower" : "leader"}
                    className="border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-400 bg-slate-700 hover:bg-slate-600"
                  />
                </div>
              </div>

              {/* Config File Name */}
              <div className="space-y-2">
                <Label
                  htmlFor="configFile"
                  className="text-sm font-medium text-slate-300"
                >
                  Calibration Config *
                </Label>
                <Input
                  id="configFile"
                  value={configFile}
                  onChange={(e) => setConfigFile(e.target.value)}
                  placeholder="config_name (e.g., my_robot_v1)"
                  className="bg-slate-700 border-slate-600 text-white rounded-md"
                />
              </div>

              {/* Available Configurations List */}
              {deviceType && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-slate-400" />
                    <Label className="text-sm font-medium text-slate-300">
                      Available Configurations
                    </Label>
                    {isLoadingConfigs && (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto bg-slate-900/50 rounded-lg border border-slate-700">
                    {availableConfigs.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-sm">
                        {isLoadingConfigs
                          ? "Loading..."
                          : "No configurations found"}
                      </div>
                    ) : (
                      <div className="space-y-1 p-2">
                        {availableConfigs.map((config) => (
                          <div
                            key={config.name}
                            className="flex items-center justify-between bg-slate-700/50 rounded-md px-3 py-2 hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => setConfigFile(config.name)}
                                className="text-left w-full text-white hover:text-blue-300 font-medium truncate"
                                title={`Click to select: ${config.name}`}
                              >
                                {config.name}
                              </button>
                              <div className="text-xs text-slate-400">
                                {new Date(
                                  config.modified * 1000
                                ).toLocaleDateString()}
                                {" • "}
                                {(config.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConfig(config.name);
                              }}
                              className="ml-3 p-1 text-red-500/80 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                              title={`Delete ${config.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator className="bg-slate-700" />

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {!calibrationStatus.calibration_active ? (
                  <Button
                    onClick={handleStartCalibration}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full py-6 text-lg"
                    disabled={
                      isLoadingConfigs || !deviceType || !port || !configFile
                    }
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Calibration
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopCalibration}
                    variant="destructive"
                    className="w-full rounded-full py-6 text-lg"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Stop Calibration
                  </Button>
                )}

                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700 rounded-full py-6 text-lg"
                  disabled={calibrationStatus.calibration_active}
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Panel */}
          <Card className="bg-slate-800/60 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-200">
                <Activity className="w-5 h-5 text-teal-400" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Status */}
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md">
                <span className="text-slate-300">Status:</span>
                <Badge
                  className={`${statusDisplay.color} text-white rounded-md`}
                >
                  {statusDisplay.icon}
                  <span className="ml-2">{statusDisplay.text}</span>
                </Badge>
              </div>

              {calibrationStatus.device_type && (
                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-md">
                  <span className="text-slate-300">Device:</span>
                  <span className="text-white capitalize">
                    {calibrationStatus.device_type}
                  </span>
                </div>
              )}

              {/* Calibration Console */}
              {calibrationStatus.calibration_active && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">
                      Calibration Console
                    </span>
                  </div>

                  {/* Console Output */}
                  <div className="bg-black rounded-lg p-4 font-mono text-sm border border-slate-700">
                    <div
                      ref={consoleRef}
                      className="text-green-400 h-80 overflow-y-auto whitespace-pre-wrap"
                    >
                      {memoizedConsoleOutput}
                    </div>
                  </div>

                  {/* Enter Button */}
                  <div className="flex justify-center">
                    <Button
                      onClick={handleSendEnter}
                      disabled={!calibrationStatus.calibration_active}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-2 rounded-full"
                    >
                      Press Enter
                    </Button>
                  </div>

                  <div className="text-xs text-slate-400 text-center">
                    Click the button above to send Enter to the calibration
                    process
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {calibrationStatus.status === "connecting" && (
                <Alert className="bg-yellow-900/50 border-yellow-700 text-yellow-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connecting to the device. Please ensure it's connected.
                  </AlertDescription>
                </Alert>
              )}

              {calibrationStatus.status === "calibrating" && (
                <Alert className="bg-blue-900/50 border-blue-700 text-blue-200">
                  <Activity className="h-4 w-4" />
                  <AlertDescription>
                    Calibration in progress. Follow device instructions.
                  </AlertDescription>
                </Alert>
              )}

              {calibrationStatus.status === "completed" && (
                <Alert className="bg-green-900/50 border-green-700 text-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Calibration completed successfully!
                  </AlertDescription>
                </Alert>
              )}

              {calibrationStatus.status === "error" &&
                calibrationStatus.error && (
                  <Alert className="bg-red-900/50 border-red-700 text-red-200">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Error:</strong> {calibrationStatus.error}
                    </AlertDescription>
                  </Alert>
                )}

              {/* Instructions */}
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h4 className="font-semibold mb-2 text-slate-200">
                  Instructions:
                </h4>
                <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                  <li>Select device type.</li>
                  <li>Enter the correct port.</li>
                  <li>Provide a name for the new calibration config.</li>
                  <li>Move the robot to a middle position.</li>
                  <li>Click "Start Calibration" & follow device prompts.</li>
                  <li>Move each motor to its limits on both sides.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PortDetectionModal
        open={showPortDetection}
        onOpenChange={setShowPortDetection}
        robotType={detectionRobotType}
        onPortDetected={handlePortDetected}
      />
    </div>
  );
};

export default Calibration;
