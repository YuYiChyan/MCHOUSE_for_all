export interface DeviceStatus {
  connected: boolean;
  transport: 'usb-hid' | 'private-usb' | 'ble' | 'web';
  sampledAt: number | null;
  values: Record<string, number | string | boolean | null>;
  error?: string;
}
export interface DeviceAdapter {
  readonly id: string;
  readonly capabilities: readonly string[];
  status(): Promise<DeviceStatus>;
  invoke(command: string, value?: unknown): Promise<unknown>;
  close(): Promise<unknown>;
}
export function createAdapter(options: {
  id: string;
  status(): DeviceStatus | Promise<DeviceStatus>;
  commands?: Record<string, (value: unknown) => unknown | Promise<unknown>>;
  close?: () => unknown | Promise<unknown>;
}): DeviceAdapter;
