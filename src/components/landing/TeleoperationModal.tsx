
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
import { Settings } from "lucide-react";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[600px] p-8">
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
              <Label htmlFor="leaderPort" className="text-sm font-medium text-gray-300">
                Leader Port
              </Label>
              <Input
                id="leaderPort"
                value={leaderPort}
                onChange={(e) => setLeaderPort(e.target.value)}
                placeholder="/dev/tty.usbmodem5A460816421"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="leaderConfig" className="text-sm font-medium text-gray-300">
                Leader Calibration Config
              </Label>
              <Select value={leaderConfig} onValueChange={setLeaderConfig}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue
                    placeholder={
                      isLoadingConfigs ? "Loading configs..." : "Select leader config"
                    }
                  />
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
              <Label htmlFor="followerPort" className="text-sm font-medium text-gray-300">
                Follower Port
              </Label>
              <Input
                id="followerPort"
                value={followerPort}
                onChange={(e) => setFollowerPort(e.target.value)}
                placeholder="/dev/tty.usbmodem5A460816621"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="followerConfig" className="text-sm font-medium text-gray-300">
                Follower Calibration Config
              </Label>
              <Select value={followerConfig} onValueChange={setFollowerConfig}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue
                    placeholder={
                      isLoadingConfigs ? "Loading configs..." : "Select follower config"
                    }
                  />
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
    </Dialog>
  );
};

export default TeleoperationModal;
