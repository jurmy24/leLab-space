import React from "react";
import { Button } from "@/components/ui/button";
import { Info, Globe, Wifi, WifiOff } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";

interface LandingHeaderProps {
  onShowInstructions: () => void;
  onShowNgrokConfig: () => void;
}

const LandingHeader: React.FC<LandingHeaderProps> = ({
  onShowInstructions,
  onShowNgrokConfig,
}) => {
  const { isNgrokEnabled } = useApi();

  return (
    <div className="relative w-full">
      {/* Ngrok button in top right */}
      <div className="absolute top-0 right-0 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowNgrokConfig}
          className={`transition-all duration-200 ${
            isNgrokEnabled
              ? "bg-green-900/30 border border-green-700 text-green-400 hover:bg-green-900/50"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
          title={
            isNgrokEnabled
              ? "Ngrok enabled - Click to configure"
              : "Configure Ngrok for external access"
          }
        >
          {isNgrokEnabled ? (
            <Wifi className="h-4 w-4 mr-2" />
          ) : (
            <Globe className="h-4 w-4 mr-2" />
          )}
          <span className="hidden sm:inline">
            {isNgrokEnabled ? "Ngrok" : "Configure Ngrok"}
          </span>
        </Button>
      </div>

      {/* Main header content */}
      <div className="text-center space-y-4 w-full pt-8">
        <img
          src="/lovable-uploads/5e648747-34b7-4d8f-93fd-4dbd00aeeefc.png"
          alt="LiveLab Logo"
          className="mx-auto h-20 w-20"
        />
        <h1 className="text-5xl font-bold tracking-tight">LeLab</h1>
        <p className="text-xl text-gray-400">LeRobot but on HFSpace.</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={onShowInstructions}
          className="mx-auto"
        >
          <Info className="h-6 w-6 text-gray-400 hover:text-white" />
        </Button>
      </div>
    </div>
  );
};
export default LandingHeader;
