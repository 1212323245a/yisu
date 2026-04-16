// Event bus for cross-component communication

type EventCallback = (data: unknown) => void;

interface EventMap {
  'lead:selected': { leadId: string; selected: boolean };
  'lead:transfer:add': { leadId: string; name: string; company?: string };
  'lead:transfer:remove': { leadId: string };
  'lead:action:import': { leadIds: string[] };
  'lead:action:delete': { leadId: string };
  'review:stage:change': { stage: string };
  'review:queue:select': { itemId: string };
  'review:audio:progress': { progress: number };
  'review:field:link': { fieldKey: string; highlightId: string };
  'ops:anomaly:select': { anomalyType: string };
  'ops:sales:select': { salesName: string };
  'ops:attribution:select': { attributionType: string };
  'ops:action:select': { actionId: string };
  'ops:task:generate': { taskId: string };
}

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<K extends keyof EventMap>(event: K, callback: (data: EventMap[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  off<K extends keyof EventMap>(event: K, callback: (data: EventMap[K]) => void): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback);
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach(cb => cb(data));
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

// Global event bus instance
export const eventBus = new EventBus();