import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Globe, Wifi, WifiOff, ExternalLink } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";
import { useToast } from "@/hooks/use-toast";

interface NgrokConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NgrokConfigModal: React.FC<NgrokConfigModalProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    ngrokUrl,
    isNgrokEnabled,
    setNgrokUrl,
    resetToLocalhost,
    fetchWithHeaders,
  } = useApi();
  const [inputUrl, setInputUrl] = useState(ngrokUrl);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!inputUrl.trim()) {
      resetToLocalhost();
      toast({
        title: "Ngrok Disabled",
        description: "Switched back to localhost mode.",
      });
      onOpenChange(false);
      return;
    }

    setIsTestingConnection(true);

    try {
      // Clean the URL
      let cleanUrl = inputUrl.trim();
      if (!cleanUrl.startsWith("http")) {
        cleanUrl = `https://${cleanUrl}`;
      }
      cleanUrl = cleanUrl.replace(/\/$/, "");

      // Test the connection
      const testResponse = await fetchWithHeaders(`${cleanUrl}/health`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (testResponse.ok) {
        setNgrokUrl(cleanUrl);
        toast({
          title: "Ngrok Configured Successfully",
          description: `Connected to ${cleanUrl}. All API calls will now use this URL.`,
        });
        onOpenChange(false);
      } else {
        throw new Error(`Server responded with status ${testResponse.status}`);
      }
    } catch (error) {
      console.error("Failed to connect to ngrok URL:", error);
      toast({
        title: "Connection Failed",
        description: `Could not connect to ${inputUrl}. Please check the URL and ensure your ngrok tunnel is running.`,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleReset = () => {
    resetToLocalhost();
    setInputUrl("");
    toast({
      title: "Reset to Localhost",
      description: "All API calls will now use localhost:8000.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6 md:p-8">
        <DialogHeader>
          <div className="flex justify-center items-center mb-4">
            <Globe className="w-8 h-8 text-blue-500" />
          </div>
          <DialogTitle className="text-white text-center text-xl sm:text-2xl font-bold">
            Ngrok Configuration
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-center text-sm sm:text-base">
            Configure ngrok tunnel for external access and phone camera
            features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-4">
          {/* Current Status */}
          <div className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              {isNgrokEnabled ? (
                <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              )}
              <span className="font-semibold text-sm sm:text-base">
                Current Mode: {isNgrokEnabled ? "Ngrok" : "Localhost"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 break-all">
              {isNgrokEnabled
                ? `Using: ${ngrokUrl}`
                : "Using: http://localhost:8000"}
            </p>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Label
              htmlFor="ngrokUrl"
              className="text-sm font-medium text-gray-300"
            >
              Ngrok URL
            </Label>
            <Input
              id="ngrokUrl"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://abc123.ngrok.io"
              className="bg-gray-800 border-gray-700 text-white text-sm sm:text-base"
            />
            <p className="text-xs text-gray-500">
              Enter your ngrok tunnel URL. Leave empty to use localhost.
            </p>
          </div>

          {/* Benefits */}
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold text-green-400 mb-2 text-sm sm:text-base">
              Why use Ngrok?
            </h3>
            <ul className="text-xs sm:text-sm text-gray-300 space-y-1">
              <li>• Access your robot from anywhere on the internet</li>
              <li>• Use phone cameras as secondary recording angles</li>
              <li>• Share your robot session with remote collaborators</li>
              <li>• Test your setup from different devices</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:gap-4 pt-4">
            <Button
              onClick={handleSave}
              disabled={isTestingConnection}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 sm:px-8 py-3 text-sm sm:text-lg transition-all shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40"
            >
              {isTestingConnection ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>

            <div className="flex flex-col sm:flex-row gap-3">
              {isNgrokEnabled && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full border-orange-500 hover:border-orange-400 text-orange-400 hover:text-orange-300 px-6 sm:px-8 py-3 text-sm sm:text-lg"
                >
                  Reset to Localhost
                </Button>
              )}

              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="w-full border-gray-500 hover:border-gray-200 px-6 sm:px-8 py-3 text-sm sm:text-lg text-zinc-500 bg-zinc-900 hover:bg-zinc-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NgrokConfigModal;
