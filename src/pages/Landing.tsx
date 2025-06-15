
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";
import RobotModelSelector from "@/components/landing/RobotModelSelector";
import ActionList from "@/components/landing/ActionList";
import PermissionModal from "@/components/landing/PermissionModal";
import TeleoperationModal from "@/components/landing/TeleoperationModal";
import RecordingModal from "@/components/landing/RecordingModal";
import { Action } from "@/components/landing/types";

const Landing = () => {
  const [robotModel, setRobotModel] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showTeleoperationModal, setShowTeleoperationModal] = useState(false);
  const [leaderPort, setLeaderPort] = useState("/dev/tty.usbmodem5A460816421");
  const [followerPort, setFollowerPort] = useState(
    "/dev/tty.usbmodem5A460816621"
  );
  const [leaderConfig, setLeaderConfig] = useState("");
  const [followerConfig, setFollowerConfig] = useState("");
  const [leaderConfigs, setLeaderConfigs] = useState<string[]>([]);
  const [followerConfigs, setFollowerConfigs] = useState<string[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);

  // Recording state
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordLeaderPort, setRecordLeaderPort] = useState(
    "/dev/tty.usbmodem5A460816421"
  );
  const [recordFollowerPort, setRecordFollowerPort] = useState(
    "/dev/tty.usbmodem5A460816621"
  );
  const [recordLeaderConfig, setRecordLeaderConfig] = useState("");
  const [recordFollowerConfig, setRecordFollowerConfig] = useState("");
  const [datasetRepoId, setDatasetRepoId] = useState("");
  const [singleTask, setSingleTask] = useState("");
  const [numEpisodes, setNumEpisodes] = useState(5);

  const navigate = useNavigate();
  const { toast } = useToast();

  const loadConfigs = async () => {
    setIsLoadingConfigs(true);
    try {
      const response = await fetch("http://localhost:8000/get-configs");
      const data = await response.json();
      setLeaderConfigs(data.leader_configs || []);
      setFollowerConfigs(data.follower_configs || []);
    } catch (error) {
      toast({
        title: "Error Loading Configs",
        description: "Could not load calibration configs from the backend.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  const handleBeginSession = () => {
    if (robotModel) {
      setShowPermissionModal(true);
    }
  };

  const handleTeleoperationClick = () => {
    if (robotModel) {
      setShowTeleoperationModal(true);
      loadConfigs();
    }
  };

  const handleRecordingClick = () => {
    if (robotModel) {
      setShowRecordingModal(true);
      loadConfigs();
    }
  };

  const handleEditDatasetClick = () => {
    if (robotModel) {
      navigate("/edit-dataset");
    }
  };

  const handleTrainingClick = () => {
    if (robotModel) {
      navigate("/training");
    }
  };

  const handleReplayDatasetClick = () => {
    if (robotModel) {
      navigate("/edit-dataset");
    }
  };

  const handleStartTeleoperation = async () => {
    if (!leaderConfig || !followerConfig) {
      toast({
        title: "Missing Configuration",
        description:
          "Please select calibration configs for both leader and follower.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/move-arm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leader_port: leaderPort,
          follower_port: followerPort,
          leader_config: leaderConfig,
          follower_config: followerConfig,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Teleoperation Started",
          description:
            data.message || "Successfully started teleoperation session.",
        });
        setShowTeleoperationModal(false);
        navigate("/teleoperation");
      } else {
        toast({
          title: "Error Starting Teleoperation",
          description: data.message || "Failed to start teleoperation session.",
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

  const handleStartRecording = async () => {
    if (
      !recordLeaderConfig ||
      !recordFollowerConfig ||
      !datasetRepoId ||
      !singleTask
    ) {
      toast({
        title: "Missing Configuration",
        description:
          "Please fill in all required fields: calibration configs, dataset ID, and task name.",
        variant: "destructive",
      });
      return;
    }

    const recordingConfig = {
      leader_port: recordLeaderPort,
      follower_port: recordFollowerPort,
      leader_config: recordLeaderConfig,
      follower_config: recordFollowerConfig,
      dataset_repo_id: datasetRepoId,
      single_task: singleTask,
      num_episodes: numEpisodes,
      episode_time_s: 60,
      reset_time_s: 15,
      fps: 30,
      video: true,
      push_to_hub: false,
      resume: false,
    };

    setShowRecordingModal(false);
    navigate("/recording", { state: { recordingConfig } });
  };

  const handlePermissions = async (allow: boolean) => {
    setShowPermissionModal(false);
    if (allow) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        toast({
          title: "Permissions Granted",
          description:
            "Camera and microphone access enabled. Entering control session...",
        });
        navigate("/control");
      } catch (error) {
        toast({
          title: "Permission Denied",
          description:
            "Camera and microphone access is required for robot control.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Permission Denied",
        description: "You can proceed, but with limited functionality.",
        variant: "destructive",
      });
      navigate("/control");
    }
  };

  const actions: Action[] = [
    {
      title: "Begin Session",
      description: "Start a new control session.",
      handler: handleBeginSession,
      color: "bg-orange-500 hover:bg-orange-600",
    },
    {
      title: "Teleoperation",
      description: "Control the robot arm in real-time.",
      handler: handleTeleoperationClick,
      color: "bg-yellow-500 hover:bg-yellow-600",
    },
    {
      title: "Record Dataset",
      description: "Record episodes for training data.",
      handler: handleRecordingClick,
      color: "bg-red-500 hover:bg-red-600",
    },
    {
      title: "Edit Dataset",
      description: "Review and modify recorded datasets.",
      handler: handleEditDatasetClick,
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      title: "Training",
      description: "Train a model on your datasets.",
      handler: handleTrainingClick,
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      title: "Replay Dataset",
      description: "Replay and analyze recorded datasets.",
      handler: handleReplayDatasetClick,
      color: "bg-purple-500 hover:bg-purple-600",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-4 pt-12 sm:pt-20">
      <LandingHeader />

      <div className="mt-12 p-8 bg-gray-900 rounded-lg shadow-xl w-full max-w-lg space-y-6 border border-gray-700">
        <RobotModelSelector
          robotModel={robotModel}
          onValueChange={setRobotModel}
        />
        <ActionList actions={actions} robotModel={robotModel} />
      </div>

      <PermissionModal
        open={showPermissionModal}
        onOpenChange={setShowPermissionModal}
        onPermissionsResult={handlePermissions}
      />

      <TeleoperationModal
        open={showTeleoperationModal}
        onOpenChange={setShowTeleoperationModal}
        leaderPort={leaderPort}
        setLeaderPort={setLeaderPort}
        followerPort={followerPort}
        setFollowerPort={setFollowerPort}
        leaderConfig={leaderConfig}
        setLeaderConfig={setLeaderConfig}
        followerConfig={followerConfig}
        setFollowerConfig={setFollowerConfig}
        leaderConfigs={leaderConfigs}
        followerConfigs={followerConfigs}
        isLoadingConfigs={isLoadingConfigs}
        onStart={handleStartTeleoperation}
      />

      <RecordingModal
        open={showRecordingModal}
        onOpenChange={setShowRecordingModal}
        leaderPort={recordLeaderPort}
        setLeaderPort={setRecordLeaderPort}
        followerPort={recordFollowerPort}
        setFollowerPort={setRecordFollowerPort}
        leaderConfig={recordLeaderConfig}
        setLeaderConfig={setRecordLeaderConfig}
        followerConfig={recordFollowerConfig}
        setFollowerConfig={setRecordFollowerConfig}
        leaderConfigs={leaderConfigs}
        followerConfigs={followerConfigs}
        datasetRepoId={datasetRepoId}
        setDatasetRepoId={setDatasetRepoId}
        singleTask={singleTask}
        setSingleTask={setSingleTask}
        numEpisodes={numEpisodes}
        setNumEpisodes={setNumEpisodes}
        isLoadingConfigs={isLoadingConfigs}
        onStart={handleStartRecording}
      />
    </div>
  );
};

export default Landing;
