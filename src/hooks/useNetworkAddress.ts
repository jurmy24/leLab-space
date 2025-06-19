import { useState, useEffect } from 'react';

interface NetworkAddressResult {
  address: string;
  isLocalhost: boolean;
  localNetworkIP: string | null;
  loading: boolean;
  error: string | null;
}

export const useNetworkAddress = (): NetworkAddressResult => {
  const [result, setResult] = useState<NetworkAddressResult>({
    address: window.location.origin,
    isLocalhost: false,
    localNetworkIP: null,
    loading: true,
    error: null,
  });

  const detectLocalNetworkIP = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('🌐 Network IP detection timeout');
        resolve(null);
      }, 3000);

      try {
        // Create RTCPeerConnection to enumerate network interfaces
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.createDataChannel('');

        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {
            clearTimeout(timeout);
            resolve(null);
          });

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;

          const candidate = event.candidate.candidate;
          console.log('🔍 ICE Candidate:', candidate);

          // Look for IPv4 addresses that are not localhost
          const ipMatch = candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          if (ipMatch) {
            const ip = ipMatch[1];
            
            // Check if it's a local network IP (not localhost, not public)
            if (
              ip !== '127.0.0.1' && 
              (ip.startsWith('192.168.') || 
               ip.startsWith('10.') || 
               ip.startsWith('172.'))
            ) {
              console.log('✅ Found local network IP:', ip);
              clearTimeout(timeout);
              pc.close();
              resolve(ip);
              return;
            }
          }
        };

        // Fallback: try to close and resolve after a short delay
        setTimeout(() => {
          if (pc.iceConnectionState !== 'closed') {
            pc.close();
          }
        }, 2000);

      } catch (error) {
        console.error('❌ Error detecting network IP:', error);
        clearTimeout(timeout);
        resolve(null);
      }
    });
  };

  const detectNetworkAddress = async () => {
    console.log('🚀 Starting network address detection...');
    
    const currentOrigin = window.location.origin;
    const hostname = window.location.hostname;
    
    console.log('📍 Current origin:', currentOrigin);
    console.log('📍 Current hostname:', hostname);

    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    
    setResult(prev => ({
      ...prev,
      isLocalhost,
      loading: true,
      error: null,
    }));

    if (isLocalhost) {
      console.log('🏠 Localhost detected, attempting to find local network IP...');
      
      try {
        const localIP = await detectLocalNetworkIP();
        
        if (localIP) {
          const port = window.location.port;
          const protocol = window.location.protocol; // Will be https: if using HTTPS
          const networkAddress = `${protocol}//${localIP}${port ? `:${port}` : ''}`;
          
          console.log('✅ Network address computed:', networkAddress);
          console.log('🔒 Protocol detected:', protocol);
          
          setResult({
            address: networkAddress,
            isLocalhost: true,
            localNetworkIP: localIP,
            loading: false,
            error: null,
          });
        } else {
          console.warn('⚠️ Could not detect local network IP, using localhost');
          setResult({
            address: currentOrigin,
            isLocalhost: true,
            localNetworkIP: null,
            loading: false,
            error: 'Could not detect local network IP',
          });
        }
      } catch (error) {
        console.error('❌ Error in network detection:', error);
        setResult({
          address: currentOrigin,
          isLocalhost: true,
          localNetworkIP: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      console.log('🌐 Using current address:', currentOrigin);
      setResult({
        address: currentOrigin,
        isLocalhost: false,
        localNetworkIP: null,
        loading: false,
        error: null,
      });
    }
  };

  useEffect(() => {
    detectNetworkAddress();
  }, []);

  return result;
};

// Utility function for one-time address detection
export const getNetworkAddress = async (): Promise<string> => {
  const currentOrigin = window.location.origin;
  const hostname = window.location.hostname;
  
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (!isLocalhost) {
    return currentOrigin;
  }

  // For localhost, try to get network IP
  try {
    const localIP = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 2000);
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;

        const candidate = event.candidate.candidate;
        const ipMatch = candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        
        if (ipMatch) {
          const ip = ipMatch[1];
          if (
            ip !== '127.0.0.1' && 
            (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.'))
          ) {
            clearTimeout(timeout);
            pc.close();
            resolve(ip);
          }
        }
      };
    });

    if (localIP) {
      const port = window.location.port;
      const protocol = window.location.protocol; // Will be https: if using HTTPS
      return `${protocol}//${localIP}${port ? `:${port}` : ''}`;
    }
  } catch (error) {
    console.error('Error detecting network IP:', error);
  }

  return currentOrigin;
}; 
