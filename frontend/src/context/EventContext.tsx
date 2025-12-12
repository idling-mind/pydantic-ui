import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { UIEvent, ToastMessage, ConfirmationRequest, FieldError } from '@/types';

interface EventContextValue {
  toasts: ToastMessage[];
  confirmationRequest: ConfirmationRequest | null;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  respondToConfirmation: (confirmed: boolean) => void;
}

const EventContext = createContext<EventContextValue | null>(null);

interface EventProviderProps {
  children: React.ReactNode;
  apiBase?: string;
  onValidationErrors?: (errors: FieldError[]) => void;
  onClearErrors?: () => void;
  onDataPush?: (data: Record<string, unknown>) => void;
  onRefresh?: () => void;
}

export function EventProvider({ 
  children, 
  apiBase = '/api',
  onValidationErrors,
  onClearErrors,
  onDataPush,
  onRefresh,
}: EventProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Determine the full API base URL
  const getFullApiBase = useCallback(() => {
    if (apiBase.startsWith('http')) {
      return apiBase;
    }
    // For relative paths, construct from current location
    const { protocol, host, pathname } = window.location;
    // Remove trailing slash and index.html if present
    let base = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    return `${protocol}//${host}${base}`;
  }, [apiBase]);

  // Add a toast notification
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    
    if (toast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.duration);
    }
  }, []);

  // Remove a toast by ID
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Handle incoming SSE events
  const handleEvent = useCallback((event: UIEvent) => {
    switch (event.type) {
      case 'validation_errors':
        if (onValidationErrors) {
          onValidationErrors(event.payload.errors as FieldError[]);
        }
        break;
      case 'clear_validation_errors':
        if (onClearErrors) {
          onClearErrors();
        }
        break;
      case 'push_data':
        if (onDataPush) {
          onDataPush(event.payload.data as Record<string, unknown>);
        }
        break;
      case 'toast':
        addToast({
          message: event.payload.message as string,
          type: (event.payload.type as ToastMessage['type']) || 'info',
          duration: (event.payload.duration as number) ?? 5000,
        });
        break;
      case 'confirmation_request':
        setConfirmationRequest({
          id: event.payload.id as string,
          title: event.payload.title as string,
          message: event.payload.message as string,
          confirmText: event.payload.confirm_text as string,
          cancelText: event.payload.cancel_text as string,
          variant: (event.payload.variant as 'default' | 'destructive') || 'default',
        });
        break;
      case 'navigate':
        {
          const { url, new_tab } = event.payload;
          if (new_tab) {
            window.open(url as string, '_blank');
          } else {
            window.location.href = url as string;
          }
        }
        break;
      case 'refresh':
        if (onRefresh) {
          onRefresh();
        }
        break;
    }
  }, [onValidationErrors, onClearErrors, onDataPush, onRefresh, addToast]);

  // Start polling fallback
  const startPolling = useCallback(() => {
    let lastTimestamp = Date.now() / 1000;
    const fullBase = getFullApiBase();
    
    const poll = async () => {
      try {
        const response = await fetch(`${fullBase}/api/events/poll?since=${lastTimestamp}`, {
          credentials: 'same-origin',  // Include cookies for session management
        });
        if (response.ok) {
          const data = await response.json();
          for (const event of data.events || []) {
            handleEvent(event);
            lastTimestamp = Math.max(lastTimestamp, event.timestamp);
          }
        }
      } catch (e) {
        console.error('Event polling failed:', e);
      }
    };
    
    // Initial poll
    poll();
    // Then poll every 1 second
    pollIntervalRef.current = window.setInterval(poll, 1000);
  }, [getFullApiBase, handleEvent]);

  // SSE connection
  useEffect(() => {
    const fullBase = getFullApiBase();
    let eventSource: EventSource | null = null;
    
    try {
      eventSource = new EventSource(`${fullBase}/api/events`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as UIEvent;
          handleEvent(data);
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      eventSource.onerror = () => {
        // Fall back to polling if SSE fails
        console.log('SSE connection failed, falling back to polling');
        eventSource?.close();
        startPolling();
      };
    } catch (e) {
      console.error('Failed to create EventSource, falling back to polling:', e);
      startPolling();
    }

    return () => {
      eventSource?.close();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [getFullApiBase, handleEvent, startPolling]);

  // Respond to confirmation dialog
  const respondToConfirmation = useCallback(async (confirmed: boolean) => {
    if (!confirmationRequest) return;
    
    const fullBase = getFullApiBase();
    
    try {
      await fetch(`${fullBase}/api/confirmation/${confirmationRequest.id}`, {
        method: 'POST',
        credentials: 'same-origin',  // Include cookies for session management
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed }),
      });
    } catch (e) {
      console.error('Failed to send confirmation response:', e);
    } finally {
      setConfirmationRequest(null);
    }
  }, [getFullApiBase, confirmationRequest]);

  return (
    <EventContext.Provider value={{
      toasts,
      confirmationRequest,
      addToast,
      removeToast,
      respondToConfirmation,
    }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within EventProvider');
  }
  return context;
}
