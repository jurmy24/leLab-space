import React from "react";
import QRCode from "react-qr-code";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "./button";
import { useToast } from "@/hooks/use-toast";

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  title?: string;
  showControls?: boolean;
  showUrl?: boolean;
  className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  url,
  size = 200,
  title = "Scan QR Code",
  showControls = true,
  showUrl = true,
  className = "",
}) => {
  const { toast } = useToast();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "URL Copied",
        description: "Phone camera URL copied to clipboard",
      });
    } catch (err) {
      console.error("Failed to copy URL:", err);
      toast({
        title: "Copy Failed",
        description: "Could not copy URL to clipboard",
        variant: "destructive",
      });
    }
  };

  const openInNewTab = () => {
    window.open(url, "_blank");
  };

  return (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      {/* QR Code */}
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <QRCode
          value={url}
          size={size}
          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          viewBox={`0 0 256 256`}
        />
      </div>

      {/* Title */}
      <div className="text-center">
        <h4 className="text-sm font-medium text-white mb-1">{title}</h4>
        {showUrl && (
          <p className="text-xs text-gray-400 max-w-xs break-all">{url}</p>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex space-x-2">
          <Button
            onClick={copyToClipboard}
            size="sm"
            variant="outline"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy URL
          </Button>
          <Button
            onClick={openInNewTab}
            size="sm"
            variant="outline"
            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open
          </Button>
        </div>
      )}
    </div>
  );
};
