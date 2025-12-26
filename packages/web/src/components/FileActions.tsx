interface FileActionsProps {
  isDirty: boolean;
  fileName: string | null;
  onLoad: (file: File) => void;
  onExport: () => void;
  onReset: () => void;
}

export function FileActions({
  isDirty,
  fileName,
  onLoad,
  onExport,
  onReset,
}: FileActionsProps) {
  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      onLoad(file);
      input.value = "";
    }
  };

  return (
    <div class="card mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <label class="btn-secondary cursor-pointer">
            <input
              type="file"
              accept=".json"
              class="hidden"
              onChange={handleFileSelect}
            />
            Load Config
          </label>
          <button onClick={onExport} class="btn-primary">
            Export Config
          </button>
          <button onClick={onReset} class="btn-secondary">
            Reset
          </button>
        </div>
        <div class="flex items-center gap-2 text-sm">
          {fileName && (
            <span class="text-gray-600">
              {fileName}
            </span>
          )}
          {isDirty && (
            <span class="badge-warning">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}
