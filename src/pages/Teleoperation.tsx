import React from "react";
import { useNavigate } from "react-router-dom";
import WebRTCVisualizerPanel from "@/components/webrtc/WebRTCVisualizerPanel";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/contexts/ApiContext";

const TeleoperationPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { baseUrl, fetchWithHeaders } = useApi();

  const handleGoBack = async () => {
    try {
      // Stop the teleoperation process before navigating back
      console.log("🛑 Stopping teleoperation...");
      const response = await fetchWithHeaders(`${baseUrl}/stop-teleoperation`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Teleoperation stopped:", result.message);
        toast({
          title: "Teleoperation Stopped",
          description:
            result.message ||
            "Robot teleoperation has been stopped successfully.",
        });
      } else {
        const errorText = await response.text();
        console.warn(
          "⚠️ Failed to stop teleoperation:",
          response.status,
          errorText
        );
        toast({
          title: "Warning",
          description: `Failed to stop teleoperation properly. Status: ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Error stopping teleoperation:", error);
      toast({
        title: "Error",
        description: "Failed to communicate with the robot server.",
        variant: "destructive",
      });
    } finally {
      // Navigate back regardless of the result
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-start justify-center p-2 sm:p-4">
      <div className="w-full min-h-[calc(100vh-1rem)] sm:min-h-[calc(100vh-2rem)] flex">
        <WebRTCVisualizerPanel onGoBack={handleGoBack} className="lg:w-full" />
      </div>
    </div>
  );
};

export default TeleoperationPage;
