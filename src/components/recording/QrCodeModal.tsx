
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Smartphone, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QrCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}

const QrCodeModal: React.FC<QrCodeModalProps> = ({
  open,
  onOpenChange,
  sessionId,
}) => {
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [phoneUrl, setPhoneUrl] = useState<string>("");

  useEffect(() => {
    if (sessionId) {
      // Get current host URL - in production this would be the deployed URL
      const currentHost = window.location.origin;
      const phonePageUrl = `${currentHost}/phone-camera?sessionId=${sessionId}`;
      setPhoneUrl(phonePageUrl);

      // Generate QR code using a public QR code API
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(phonePageUrl)}`;
      setQrCodeUrl(qrApiUrl);
    }
  }, [sessionId]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(phoneUrl);
      toast({
        title: "URL Copied!",
        description: "Phone camera URL has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[500px] p-8">
        <DialogHeader>
          <div className="flex justify-center items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
          </div>
          <DialogTitle className="text-white text-center text-2xl font-bold">
            Add Phone Camera
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-base leading-relaxed text-center">
            Scan the QR code with your phone to add a camera feed to your recording session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* QR Code Display */}
          <div className="flex justify-center">
            {qrCodeUrl ? (
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={qrCodeUrl}
                  alt="QR Code for phone camera"
                  className="w-48 h-48"
                />
              </div>
            ) : (
              <div className="w-48 h-48 bg-gray-800 rounded-lg flex items-center justify-center">
                <QrCode className="w-12 h-12 text-gray-600" />
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white text-center">
              How to connect your phone camera:
            </h3>
            <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
              <li>Open your phone's camera app</li>
              <li>Scan the QR code above</li>
              <li>Allow camera permissions when prompted</li>
              <li>Your phone camera feed will appear in the recording interface</li>
            </ol>
          </div>

          {/* Manual URL Option */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-300">
              Or open this URL manually on your phone:
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={phoneUrl}
                readOnly
                className="flex-1 bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded text-sm"
              />
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="sm"
                className="border-gray-600 hover:border-blue-500 text-gray-300 hover:text-blue-400"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="border-gray-500 hover:border-gray-200 px-8 py-2 text-gray-300 hover:text-white"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QrCodeModal;
