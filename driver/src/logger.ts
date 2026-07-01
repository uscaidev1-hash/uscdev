export function info(message: string): void {
  console.log(`${new Date().toLocaleTimeString()} ${message}`);
}

export function warn(message: string): void {
  console.warn(`${new Date().toLocaleTimeString()} [주의] ${message}`);
}

export function error(message: string): void {
  console.error(`${new Date().toLocaleTimeString()} [오류] ${message}`);
}
