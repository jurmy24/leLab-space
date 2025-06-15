
import React from 'react';
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[600px] p-8 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-center items-center gap-4 mb-4">
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

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
                Robot Configuration
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recordLeaderPort" className="text-sm font-medium text-gray-300">
                    Leader Port
                  </Label>
                  <Input
                    id="recordLeaderPort"
                    value={leaderPort}
                    onChange={(e) => setLeaderPort(e.target.value)}
                    placeholder="/dev/tty.usbmodem5A460816421"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recordLeaderConfig" className="text-sm font-medium text-gray-300">
                    Leader Calibration Config
                  </Label>
                  <Select value={leaderConfig} onValueChange={setLeaderConfig}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder={isLoadingConfigs ? "Loading configs..." : "Select leader config"} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {leaderConfigs.map((config) => (
                        <SelectItem key={config} value={config} className="text-white hover:bg-gray-700">
                          {config}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recordFollowerPort" className="text-sm font-medium text-gray-300">
                    Follower Port
                  </Label>
                  <Input
                    id="recordFollowerPort"
                    value={followerPort}
                    onChange={(e) => setFollowerPort(e.target.value)}
                    placeholder="/dev/tty.usbmodem5A460816621"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recordFollowerConfig" className="text-sm font-medium text-gray-300">
                    Follower Calibration Config
                  </Label>
                  <Select value={followerConfig} onValueChange={setFollowerConfig}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder={isLoadingConfigs ? "Loading configs..." : "Select follower config"} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {followerConfigs.map((config) => (
                        <SelectItem key={config} value={config} className="text-white hover:bg-gray-700">
                          {config}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
                Dataset Configuration
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="datasetRepoId" className="text-sm font-medium text-gray-300">
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
                  <Label htmlFor="singleTask" className="text-sm font-medium text-gray-300">
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
                  <Label htmlFor="numEpisodes" className="text-sm font-medium text-gray-300">
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
  );
};

export default RecordingModal;
