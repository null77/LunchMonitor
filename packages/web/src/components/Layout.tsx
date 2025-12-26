import type { ComponentChildren } from "preact";

interface LayoutProps {
  children: ComponentChildren;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <span class="text-white text-xl font-bold">$</span>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">LunchMonitor</h1>
              <p class="text-sm text-gray-500">Configuration Editor</p>
            </div>
          </div>
          <a
            href="https://lunchmoney.dev/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-primary-600 hover:text-primary-700"
          >
            LunchMoney API Docs
          </a>
        </div>
      </header>
      <main class="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
