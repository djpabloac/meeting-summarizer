const BAR_LENGTH = 30;

export interface ProgressBar {
  update(current: number, total: number, message: string): void;
  complete(message: string): void;
  fail(message: string): void;
}

export function createProgressBar(label: string): ProgressBar {
  function render(current: number, total: number, message: string) {
    const percent = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * BAR_LENGTH);
    const empty = BAR_LENGTH - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    process.stdout.write(`\r${label} [${bar}] ${percent}% ${message}`);
  }

  return {
    update(current: number, total: number, message: string) {
      render(current, total, message);
    },
    complete(message: string) {
      const bar = "█".repeat(BAR_LENGTH);
      process.stdout.write(`\r${label} [${bar}] 100% ✅ ${message}\n`);
    },
    fail(message: string) {
      process.stdout.write(`\r${label} ❌ ${message}\n`);
    },
  };
}

export function createSpinner(message: string) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let currentMsg = message;
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i++ % frames.length]} ${currentMsg}`);
  }, 100);
  return {
    update(msg: string) { currentMsg = msg; },
    stop(finalMsg: string) {
      clearInterval(interval);
      process.stdout.write(`\r${finalMsg}\n`);
    },
  };
}
