import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Terminal } from "lucide-react";
import { useApi } from "@/contexts/ApiContext";

interface UsageInstructionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UsageInstructionsModal: React.FC<UsageInstructionsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { baseUrl } = useApi();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-300 sm:max-w-xl">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-white flex items-center justify-center gap-2 text-xl">
            <Terminal className="w-6 h-6" />
            Running LeLab Locally
          </DialogTitle>
          <DialogDescription>
            Instructions for setting up and running the project on your machine.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-8 text-sm py-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-100 text-lg mb-2 border-b border-gray-700 pb-2">
              1. Installation
            </h4>
            <p>
              Clone the repository from GitHub:{" "}
              <a
                href="https://github.com/nicolas-rabault/leLab"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                nicolas-rabault/leLab
              </a>
            </p>
            <pre className="bg-gray-800 p-3 rounded-md text-xs overflow-x-auto text-left">
              <code>
                git clone https://github.com/nicolas-rabault/leLab
                <br />
                cd leLab
              </code>
            </pre>
            <p className="mt-2 font-medium text-gray-200">
              Install dependencies (virtual environment recommended):
            </p>
            <pre className="bg-gray-800 p-3 rounded-md text-xs overflow-x-auto text-left">
              <code>
                # Create and activate virtual environment
                <br />
                python -m venv .venv
                <br />
                source .venv/bin/activate
                <br />
                <br />
                # Install in editable mode
                <br />
                pip install -e .
              </code>
            </pre>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-100 text-lg mb-2 border-b border-gray-700 pb-2">
              2. Running the Application
            </h4>
            <p>After installation, use one of the command-line tools:</p>
            <ul className="space-y-4 text-xs text-left">
              <li>
                <code className="bg-gray-800 p-1 rounded font-mono text-sm">
                  lelab
                </code>
                <p className="text-gray-400 mt-1">
                  Starts only the FastAPI backend server on{" "}
                  <a
                    href={baseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {baseUrl}
                  </a>
                  .
                </p>
              </li>
              <li>
                <code className="bg-gray-800 p-1 rounded font-mono text-sm">
                  lelab-fullstack
                </code>
                <p className="text-gray-400 mt-1">
                  Starts both FastAPI backend (port 8000) and this Vite frontend
                  (port 8080).
                </p>
              </li>
              <li>
                <code className="bg-gray-800 p-1 rounded font-mono text-sm">
                  lelab-frontend
                </code>
                <p className="text-gray-400 mt-1">
                  Starts only the frontend development server.
                </p>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UsageInstructionsModal;
