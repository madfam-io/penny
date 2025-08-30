import { useState, useCallback, useEffect } from 'react';\nimport { useWebSocket } from './useWebSocket';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
  userId: string;
  userName: string;
  status: PresenceStatus;
  lastActive: Date;
  customMessage?: string;
}

export interface UsePresenceReturn {
  currentStatus: PresenceStatus;
  userPresences: Map<string, UserPresence>;
  updateStatus: (status: PresenceStatus, customMessage?: string) => void;
  getUserPresence: (userId: string) => UserPresence | undefined;
  getOnlineUsers: () => UserPresence[];
  isUserOnline: (userId: string) => boolean;
}

export function usePresence(): UsePresenceReturn {
  const { socket, isConnected, emit, on, off } = useWebSocket();
  
  const [currentStatus, setCurrentStatus] = useState<PresenceStatus>('offline');
  const [userPresences, setUserPresences] = useState<Map<string, UserPresence>>(new Map());

  // Update presence status
  const updateStatus = useCallback((status: PresenceStatus, customMessage?: string) => {
    if (!socket || !isConnected) return;

    emit('presence_update', { status, customMessage });
    setCurrentStatus(status);
  }, [socket, isConnected, emit]);

  // Get user presence
  const getUserPresence = useCallback((userId: string) => {
    return userPresences.get(userId);
  }, [userPresences]);

  // Get online users
  const getOnlineUsers = useCallback(() => {
    return Array.from(userPresences.values()).filter(
      presence => presence.status === 'online'
    );
  }, [userPresences]);

  // Check if user is online
  const isUserOnline = useCallback((userId: string) => {
    const presence = userPresences.get(userId);
    return presence?.status === 'online';
  }, [userPresences]);

  // Setup event listeners
  useEffect(() => {
    if (!socket) return;

    const handleUserPresenceChanged = (data: any) => {
      const presence: UserPresence = {
        userId: data.userId,
        userName: data.userName,
        status: data.status,
        lastActive: new Date(data.lastActive),
        customMessage: data.customMessage
      };

      setUserPresences(prev => new Map(prev).set(data.userId, presence));
    };

    on('user_presence_changed', handleUserPresenceChanged);

    return () => {
      off('user_presence_changed', handleUserPresenceChanged);
    };
  }, [socket, on, off]);

  // Set initial status when connected
  useEffect(() => {
    if (isConnected && currentStatus === 'offline') {
      updateStatus('online');
    }
  }, [isConnected, currentStatus, updateStatus]);

  return {
    currentStatus,
    userPresences,
    updateStatus,
    getUserPresence,
    getOnlineUsers,
    isUserOnline
  };
}