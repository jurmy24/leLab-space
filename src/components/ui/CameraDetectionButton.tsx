import React from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

interface CameraDetectionButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const CameraDetectionButton: React.FC<CameraDetectionButtonProps> = ({
  onClick,
  disabled = false,
}) => {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      title="Detect Cameras"
    >
      <Camera className="w-4 h-4" />
    </Button>
  );
};

export default CameraDetectionButton;