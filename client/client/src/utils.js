export class ToggleableNetworkStatus  {
  constructor() {
    this.online = true;
  }

  onStatusChangeListener(callback) {
    this.callback = callback;
  }

  isOffline() {
    const online = this.online;
    return new Promise(resolve => resolve(!online));
  }

  setOnline(online) {
    this.online = online;
    this.callback && this.callback.onStatusChange({ online });
  }
};

export const waitFor = async (conditionFn, time = 0) => {
  while (!(await conditionFn())) {
    await new Promise(resolve => setTimeout(resolve, time));
  }
};

export const storageUsage = () => {
  return (localStorage.getItem('offline-mutation-store').length * 16)/(8 * 1024);
};