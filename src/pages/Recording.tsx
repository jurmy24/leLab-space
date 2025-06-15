import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Square, SkipForward, RotateCcw, Play } from "lucide-react";
import UrdfViewer from "@/components/UrdfViewer";
import UrdfProcessorInitializer from "@/components/UrdfProcessorInitializer";
import PhoneCameraFeed from "@/components/recording/PhoneCameraFeed";
import { useApi } from "@/contexts/ApiContext";

interface RecordingConfig {
  leader_port: string;
  follower_port: string;
  leader_config: string;
  follower_config: string;
  dataset_repo_id: string;
  single_task: string;
  num_episodes: number;
  episode_time_s: number;
  reset_time_s: number;
  fps: number;
  video: boolean;
  push_to_hub: boolean;
  resume: boolean;
}

interface BackendStatus {
  recording_active: boolean;
  current_phase: string;
  current_episode?: number;
  total_episodes?: number;
  saved_episodes?: number;
  phase_elapsed_seconds?: number;
  phase_time_limit_s?: number;
  session_elapsed_seconds?: number;
  session_ended?: boolean;
  available_controls: {
    stop_recording: boolean;
    exit_early: boolean;
    rerecord_episode: boolean;
  };
}

const Recording = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { baseUrl, wsBaseUrl, fetchWithHeaders } = useApi();

  // Get recording config from navigation state
  const recordingConfig = location.state?.recordingConfig as RecordingConfig;

  // Backend status state - this is the single source of truth
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(
    null
  );
  const [recordingSessionStarted, setRecordingSessionStarted] = useState(false);

  // QR Code and camera states
  const [showQrModal, setShowQrModal] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [phoneCameraConnected, setPhoneCameraConnected] = useState(false);

  // Redirect if no config provided
  useEffect(() => {
    if (!recordingConfig) {
      toast({
        title: "No Configuration",
        description: "Please start recording from the main page.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [recordingConfig, navigate, toast]);

  // Start recording session when component loads
  useEffect(() => {
    if (recordingConfig && !recordingSessionStarted) {
      startRecordingSession();
    }
  }, [recordingConfig, recordingSessionStarted]);

  // Poll backend status continuously to stay in sync
  useEffect(() => {
    let statusInterval: NodeJS.Timeout;

    if (recordingSessionStarted) {
      const pollStatus = async () => {
        try {
          const response = await fetchWithHeaders(
            `${baseUrl}/recording-status`
          );
          if (response.ok) {
            const status = await response.json();
            setBackendStatus(status);

            // If backend recording stopped and session ended, navigate to upload
            if (
              !status.recording_active &&
              status.session_ended &&
              recordingSessionStarted
            ) {
              // Navigate to upload window with dataset info
              const datasetInfo = {
                dataset_repo_id: recordingConfig.dataset_repo_id,
                single_task: recordingConfig.single_task,
                num_episodes: recordingConfig.num_episodes,
                saved_episodes: status.saved_episodes || 0,
                session_elapsed_seconds: status.session_elapsed_seconds || 0,
              };

              navigate("/upload", { state: { datasetInfo } });
              return; // Stop polling after navigation
            }
          }
        } catch (error) {
          console.error("Error polling recording status:", error);
        }
      };

      // Poll immediately and then every second for real-time updates
      pollStatus();
      statusInterval = setInterval(pollStatus, 1000);
    }

    return () => {
      if (statusInterval) clearInterval(statusInterval);
    };
  }, [recordingSessionStarted, recordingConfig, navigate, toast]);

  // Generate session ID when component loads
  useEffect(() => {
    const newSessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    setSessionId(newSessionId);
  }, []);

  // Listen for phone camera connections
  useEffect(() => {
    if (!sessionId) return;

    const connectToPhoneCameraWS = () => {
      const ws = new WebSocket(`${wsBaseUrl}/ws/camera/${sessionId}`);

      ws.onopen = () => {
        console.log("Phone camera WebSocket connected");
      };

      ws.onmessage = (event) => {
        if (event.data === "camera_connected" && !phoneCameraConnected) {
          setPhoneCameraConnected(true);
          toast({
            title: "Phone Camera Connected!",
            description: "New camera feed detected and connected successfully.",
          });
        }
      };

      ws.onclose = () => {
        console.log("Phone camera WebSocket disconnected");
        setPhoneCameraConnected(false);
      };

      ws.onerror = (error) => {
        console.error("Phone camera WebSocket error:", error);
      };

      return ws;
    };

    const ws = connectToPhoneCameraWS();
    return () => ws.close();
  }, [sessionId, phoneCameraConnected, toast]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const startRecordingSession = async () => {
    try {
      const response = await fetchWithHeaders(`${baseUrl}/start-recording`, {
        method: "POST",
        body: JSON.stringify(recordingConfig),
      });

      const data = await response.json();

      if (response.ok) {
        setRecordingSessionStarted(true);
        toast({
          title: "Recording Started",
          description: `Started recording ${recordingConfig.num_episodes} episodes`,
        });
      } else {
        toast({
          title: "Error Starting Recording",
          description: data.message || "Failed to start recording session.",
          variant: "destructive",
        });
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Could not connect to the backend server.",
        variant: "destructive",
      });
      navigate("/");
    }
  };

  // Equivalent to pressing RIGHT ARROW key in original record.py
  const handleExitEarly = async () => {
    if (!backendStatus?.available_controls.exit_early) return;

    try {
      const response = await fetchWithHeaders(
        `${baseUrl}/recording-exit-early`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (response.ok) {
        const currentPhase = backendStatus.current_phase;
        if (currentPhase === "recording") {
          toast({
            title: "Episode Recording Ended",
            description: `Episode ${backendStatus.current_episode} recording completed. Moving to reset phase.`,
          });
        } else if (currentPhase === "resetting") {
          toast({
            title: "Reset Complete",
            description: `Moving to next episode...`,
          });
        }
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Could not connect to the backend server.",
        variant: "destructive",
      });
    }
  };

  // Equivalent to pressing LEFT ARROW key in original record.py
  const handleRerecordEpisode = async () => {
    if (!backendStatus?.available_controls.rerecord_episode) return;

    try {
      const response = await fetchWithHeaders(
        `${baseUrl}/recording-rerecord-episode`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Re-recording Episode",
          description: `Episode ${backendStatus.current_episode} will be re-recorded.`,
        });
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Could not connect to the backend server.",
        variant: "destructive",
      });
    }
  };

  // Equivalent to pressing ESC key in original record.py
  const handleStopRecording = async () => {
    try {
      const response = await fetchWithHeaders(`${baseUrl}/stop-recording`, {
        method: "POST",
      });

      toast({
        title: "Recording Stopped",
        description: "Recording session has been stopped.",
      });

      // Navigate to upload window with current dataset info
      const datasetInfo = {
        dataset_repo_id: recordingConfig.dataset_repo_id,
        single_task: recordingConfig.single_task,
        num_episodes: recordingConfig.num_episodes,
        saved_episodes: backendStatus?.saved_episodes || 0,
        session_elapsed_seconds: backendStatus?.session_elapsed_seconds || 0,
      };

      navigate("/upload", { state: { datasetInfo } });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop recording.",
        variant: "destructive",
      });
    }
  };

  if (!recordingConfig) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">No recording configuration found.</p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state while waiting for backend status
  if (!backendStatus) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-lg">Connecting to recording session...</p>
        </div>
      </div>
    );
  }

  const currentPhase = backendStatus.current_phase;
  const currentEpisode = backendStatus.current_episode || 1;
  const totalEpisodes =
    backendStatus.total_episodes || recordingConfig.num_episodes;
  const phaseElapsedTime = backendStatus.phase_elapsed_seconds || 0;
  const phaseTimeLimit =
    backendStatus.phase_time_limit_s ||
    (currentPhase === "recording"
      ? recordingConfig.episode_time_s
      : recordingConfig.reset_time_s);
  const sessionElapsedTime = backendStatus.session_elapsed_seconds || 0;

  const getPhaseTitle = () => {
    if (currentPhase === "recording") return "Episode Recording Time";
    if (currentPhase === "resetting") return "Environment Reset Time";
    return "Phase Time";
  };

  const getStatusText = () => {
    if (currentPhase === "recording")
      return `RECORDING EPISODE ${currentEpisode}`;
    if (currentPhase === "resetting") return "RESET THE ENVIRONMENT";
    if (currentPhase === "preparing") return "PREPARING SESSION";
    return "SESSION COMPLETE";
  };

  const getStatusColor = () => {
    if (currentPhase === "recording") return "text-red-400";
    if (currentPhase === "resetting") return "text-orange-400";
    if (currentPhase === "preparing") return "text-yellow-400";
    return "text-gray-400";
  };

  const getDotColor = () => {
    if (currentPhase === "recording") return "bg-red-500 animate-pulse";
    if (currentPhase === "resetting") return "bg-orange-500 animate-pulse";
    if (currentPhase === "preparing") return "bg-yellow-500";
    return "bg-gray-500";
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="border-gray-500 hover:border-gray-200 text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getDotColor()}`}></div>
              <h1 className="text-3xl font-bold">Recording Session</h1>
            </div>
          </div>
        </div>

        {/* Main Recording Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Phase Timer */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 text-center">
            <h2 className="text-sm text-gray-400 mb-2">{getPhaseTitle()}</h2>
            <div
              className={`text-4xl font-mono font-bold mb-2 ${
                currentPhase === "recording"
                  ? "text-green-400"
                  : "text-orange-400"
              }`}
            >
              {formatTime(phaseElapsedTime)}
            </div>
            <div className="text-sm text-gray-400">
              / {formatTime(phaseTimeLimit)}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ${
                  currentPhase === "recording"
                    ? "bg-green-500"
                    : "bg-orange-500"
                }`}
                style={{
                  width: `${Math.min(
                    (phaseElapsedTime / phaseTimeLimit) * 100,
                    100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Episode Progress */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 text-center">
            <h2 className="text-sm text-gray-400 mb-2">Episode Progress</h2>
            <div className="text-4xl font-bold text-blue-400 mb-2">
              {currentEpisode} of {totalEpisodes}
            </div>
            <div className="text-sm text-gray-400">
              {recordingConfig.single_task}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(currentEpisode / totalEpisodes) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Session Timer */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 text-center">
            <h2 className="text-sm text-gray-400 mb-2">Total Session Time</h2>
            <div className="text-4xl font-mono font-bold text-yellow-400 mb-2">
              {formatTime(sessionElapsedTime)}
            </div>
            <div className="text-sm text-gray-400">
              Dataset: {recordingConfig.dataset_repo_id}
            </div>
          </div>
        </div>

        {/* Status and Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Recording Status - takes up 3 columns */}
          <div className="lg:col-span-3 bg-gray-900 rounded-lg p-6 border border-gray-700">
            {/* Status header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Recording Status
                </h2>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${getDotColor()}`}
                  ></div>
                  <span className={`font-semibold ${getStatusColor()}`}>
                    {getStatusText()}
                  </span>
                </div>
              </div>
            </div>

            {/* Recording Phase Controls */}
            {currentPhase === "recording" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Button
                  onClick={handleExitEarly}
                  disabled={!backendStatus.available_controls.exit_early}
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold py-4 text-lg disabled:opacity-50"
                >
                  <SkipForward className="w-5 h-5 mr-2" />
                  End Episode
                </Button>

                <Button
                  onClick={handleRerecordEpisode}
                  disabled={!backendStatus.available_controls.rerecord_episode}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 text-lg disabled:opacity-50"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Re-record Episode
                </Button>

                <Button
                  onClick={handleStopRecording}
                  disabled={!backendStatus.available_controls.stop_recording}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-4 text-lg disabled:opacity-50"
                >
                  <Square className="w-5 h-5 mr-2" />
                  Stop Recording
                </Button>
              </div>
            )}

            {/* Reset Phase Controls */}
            {currentPhase === "resetting" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={handleExitEarly}
                  disabled={!backendStatus.available_controls.exit_early}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-6 text-xl disabled:opacity-50"
                >
                  <Play className="w-6 h-6 mr-2" />
                  Continue to Next Phase
                </Button>

                <Button
                  onClick={handleStopRecording}
                  disabled={!backendStatus.available_controls.stop_recording}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-6 text-xl disabled:opacity-50"
                >
                  <Square className="w-5 h-5 mr-2" />
                  Stop Recording
                </Button>
              </div>
            )}

            {currentPhase === "completed" && (
              <div className="text-center">
                <p className="text-lg text-green-400 mb-6">
                  ✅ Recording session completed successfully!
                </p>
                <p className="text-gray-400 mb-6">
                  Dataset:{" "}
                  <span className="text-white font-semibold">
                    {recordingConfig.dataset_repo_id}
                  </span>
                </p>
                <p className="text-gray-400 mb-6">
                  You will be redirected to the upload window shortly...
                </p>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <h3 className="font-semibold mb-2">
                {currentPhase === "recording"
                  ? "Episode Recording Instructions:"
                  : currentPhase === "resetting"
                  ? "Environment Reset Instructions:"
                  : "Session Instructions:"}
              </h3>
              {currentPhase === "recording" && (
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>
                    • <strong>End Episode:</strong> Complete current episode and
                    enter reset phase (Right Arrow)
                  </li>
                  <li>
                    • <strong>Re-record Episode:</strong> Restart current
                    episode after reset phase (Left Arrow)
                  </li>
                  <li>
                    • <strong>Auto-end:</strong> Episode ends automatically
                    after {formatTime(phaseTimeLimit)}
                  </li>
                  <li>
                    • <strong>Stop Recording:</strong> End entire session (ESC
                    key)
                  </li>
                </ul>
              )}
              {currentPhase === "resetting" && (
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>
                    • <strong>Continue to Next Phase:</strong> Skip reset phase
                    and continue (Right Arrow)
                  </li>
                  <li>
                    • <strong>Auto-continue:</strong> Automatically continues
                    after {formatTime(phaseTimeLimit)}
                  </li>
                  <li>
                    • <strong>Reset Phase:</strong> Use this time to prepare
                    your environment for the next episode
                  </li>
                  <li>
                    • <strong>Stop Recording:</strong> End entire session (ESC
                    key)
                  </li>
                </ul>
              )}
            </div>
          </div>

          {/* Phone Camera Feed - takes up 1 column */}
          {phoneCameraConnected && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">
                Phone Camera
              </h3>
              <PhoneCameraFeed sessionId={sessionId} />
            </div>
          )}
        </div>

        {/* URDF Viewer Section */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Robot Visualizer
          </h2>
          <div className="h-96 bg-gray-800 rounded-lg overflow-hidden">
            <UrdfViewer />
            <UrdfProcessorInitializer />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recording;
