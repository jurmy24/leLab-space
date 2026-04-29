import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface ApiContextType {
  baseUrl: string;
  wsBaseUrl: string;
  isNgrokEnabled: boolean;
  setNgrokUrl: (url: string) => void;
  resetToLocalhost: () => void;
  ngrokUrl: string;
  getHeaders: () => Record<string, string>;
  fetchWithHeaders: (url: string, options?: RequestInit) => Promise<Response>;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

const DEFAULT_LOCALHOST = "http://localhost:8000";
const DEFAULT_WS_LOCALHOST = "ws://localhost:8000";

interface ApiProviderProps {
  children: ReactNode;
}

export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  const [ngrokUrl, setNgrokUrlState] = useState<string>("");
  const [isNgrokEnabled, setIsNgrokEnabled] = useState<boolean>(false);

  // Load saved ngrok configuration on mount
  useEffect(() => {
    const savedNgrokUrl = localStorage.getItem("ngrok-url");
    const savedNgrokEnabled = localStorage.getItem("ngrok-enabled") === "true";

    if (savedNgrokUrl && savedNgrokEnabled) {
      setNgrokUrlState(savedNgrokUrl);
      setIsNgrokEnabled(true);
    }
  }, []);

  const setNgrokUrl = (url: string) => {
    // Clean and validate the URL
    let cleanUrl = url.trim();
    if (cleanUrl && !cleanUrl.startsWith("http")) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // Remove trailing slash
    cleanUrl = cleanUrl.replace(/\/$/, "");

    setNgrokUrlState(cleanUrl);
    setIsNgrokEnabled(!!cleanUrl);

    // Persist to localStorage
    if (cleanUrl) {
      localStorage.setItem("ngrok-url", cleanUrl);
      localStorage.setItem("ngrok-enabled", "true");
    } else {
      localStorage.removeItem("ngrok-url");
      localStorage.removeItem("ngrok-enabled");
    }
  };

  const resetToLocalhost = () => {
    setNgrokUrlState("");
    setIsNgrokEnabled(false);
    localStorage.removeItem("ngrok-url");
    localStorage.removeItem("ngrok-enabled");
  };

  const baseUrl = isNgrokEnabled && ngrokUrl ? ngrokUrl : DEFAULT_LOCALHOST;
  const wsBaseUrl =
    isNgrokEnabled && ngrokUrl
      ? ngrokUrl.replace("https://", "wss://").replace("http://", "ws://")
      : DEFAULT_WS_LOCALHOST;

  // Helper function to get headers with ngrok skip warning if needed
  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add ngrok skip warning header when using ngrok
    if (isNgrokEnabled && ngrokUrl) {
      headers["ngrok-skip-browser-warning"] = "true";
    }

    return headers;
  };

  // Enhanced fetch function that automatically includes necessary headers
  const fetchWithHeaders = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const enhancedOptions: RequestInit = {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    };

    return fetch(url, enhancedOptions);
  };

  return (
    <ApiContext.Provider
      value={{
        baseUrl,
        wsBaseUrl,
        isNgrokEnabled,
        setNgrokUrl,
        resetToLocalhost,
        ngrokUrl,
        getHeaders,
        fetchWithHeaders,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error("useApi must be used within an ApiProvider");
  }
  return context;
};
