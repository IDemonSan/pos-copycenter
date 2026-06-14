// Mock para expo-haptics — evita errores de módulo nativo en tests
export const ImpactFeedbackStyle = {
  Light: 'Light',
  Medium: 'Medium',
  Heavy: 'Heavy',
};

export const NotificationFeedbackType = {
  Success: 'Success',
  Warning: 'Warning',
  Error: 'Error',
};

export async function impactAsync(_style) {
  return Promise.resolve();
}

export async function notificationAsync(_type) {
  return Promise.resolve();
}

export async function selectionAsync() {
  return Promise.resolve();
}
