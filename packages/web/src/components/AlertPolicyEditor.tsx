import { useState, useEffect } from "preact/hooks";
import type { AlertPolicy, ThresholdConfig, PolicyScope } from "@lunchmonitor/core";
import { resolveBaseUrl } from "@lunchmonitor/core/base-url";

interface Category {
  id: number;
  name: string;
  is_group: boolean;
  group_id: number | null;
  archived: boolean;
}

interface AlertPolicyEditorProps {
  policies: AlertPolicy[];
  apiToken: string;
  apiBaseUrl?: string;
  onAdd: (policy: AlertPolicy) => void;
  onUpdate: (id: string, updates: Partial<AlertPolicy>) => void;
  onRemove: (id: string) => void;
}

function createDefaultPolicy(): AlertPolicy {
  return {
    id: crypto.randomUUID(),
    name: "New Policy",
    enabled: true,
    scope: { type: "global" },
    thresholds: [
      { type: "percentage", operator: "gte", value: 80 },
      { type: "percentage", operator: "gte", value: 100 },
    ],
    channels: ["email"],
    cooldown: { type: "once_per_threshold" },
  };
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

interface CategorySelectorProps {
  categories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  loading: boolean;
  error: string | null;
}

function CategorySelector({ categories, selectedIds, onChange, loading, error }: CategorySelectorProps) {
  if (loading) {
    return <p class="text-sm text-gray-500 italic">Loading categories...</p>;
  }

  if (error) {
    return <p class="text-sm text-red-500">{error}</p>;
  }

  if (categories.length === 0) {
    return <p class="text-sm text-gray-500">No categories found. Make sure your API token is configured.</p>;
  }

  // Group categories by their group
  const groups = categories.filter((c) => c.is_group && !c.archived);
  const ungrouped = categories.filter((c) => !c.is_group && !c.group_id && !c.archived);
  const grouped = categories.filter((c) => !c.is_group && c.group_id && !c.archived);

  const toggleCategory = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    const allIds = categories.filter((c) => !c.is_group && !c.archived).map((c) => c.id);
    onChange(allIds);
  };

  const selectNone = () => {
    onChange([]);
  };

  return (
    <div class="space-y-2">
      <div class="flex gap-2 text-sm">
        <button type="button" onClick={selectAll} class="text-primary-600 hover:text-primary-700">
          Select All
        </button>
        <span class="text-gray-300">|</span>
        <button type="button" onClick={selectNone} class="text-primary-600 hover:text-primary-700">
          Select None
        </button>
        <span class="text-gray-400 ml-2">({selectedIds.length} selected)</span>
      </div>
      <div class="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
        {/* Ungrouped categories */}
        {ungrouped.map((cat) => (
          <label key={cat.id} class="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.includes(cat.id)}
              onChange={() => toggleCategory(cat.id)}
              class="h-4 w-4 text-primary-600 rounded"
            />
            <span class="text-sm">{decodeHtmlEntities(cat.name)}</span>
          </label>
        ))}

        {/* Grouped categories */}
        {groups.map((group) => {
          const children = grouped.filter((c) => c.group_id === group.id);
          if (children.length === 0) return null;

          return (
            <div key={group.id} class="mt-2">
              <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                {decodeHtmlEntities(group.name)}
              </div>
              {children.map((cat) => (
                <label key={cat.id} class="flex items-center gap-2 p-1 pl-4 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    class="h-4 w-4 text-primary-600 rounded"
                  />
                  <span class="text-sm">{decodeHtmlEntities(cat.name)}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PolicyFormProps {
  policy: AlertPolicy;
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  onUpdate: (updates: Partial<AlertPolicy>) => void;
  onRemove: () => void;
}

function PolicyForm({ policy, categories, categoriesLoading, categoriesError, onUpdate, onRemove }: PolicyFormProps) {
  const [expanded, setExpanded] = useState(false);

  const updateThreshold = (index: number, updates: Partial<ThresholdConfig>) => {
    const newThresholds = [...policy.thresholds];
    newThresholds[index] = { ...newThresholds[index], ...updates };
    onUpdate({ thresholds: newThresholds });
  };

  const addThreshold = () => {
    onUpdate({
      thresholds: [
        ...policy.thresholds,
        { type: "percentage", operator: "gte", value: 90 },
      ],
    });
  };

  const removeThreshold = (index: number) => {
    onUpdate({
      thresholds: policy.thresholds.filter((_, i) => i !== index),
    });
  };

  return (
    <div class="border border-gray-200 rounded-lg overflow-hidden">
      <div
        class="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div class="flex items-center gap-3">
          <input
            type="checkbox"
            checked={policy.enabled}
            onChange={(e) => {
              e.stopPropagation();
              onUpdate({ enabled: (e.target as HTMLInputElement).checked });
            }}
            class="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
          />
          <span class={`font-medium ${!policy.enabled ? "text-gray-400" : ""}`}>
            {policy.name}
          </span>
          <span class="badge bg-gray-100 text-gray-600">
            {policy.scope.type === "category"
              ? `${policy.scope.categoryIds?.length ?? 0} categories`
              : policy.scope.type}
          </span>
          <span class="text-sm text-gray-500">
            {policy.thresholds.map((t) => `${t.value}${t.type === "percentage" ? "%" : ""}`).join(", ")}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div class="p-4 space-y-4 border-t border-gray-200">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Policy Name</label>
              <input
                type="text"
                class="input"
                value={policy.name}
                onInput={(e) => onUpdate({ name: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div>
              <label class="label">Scope</label>
              <select
                class="input"
                value={policy.scope.type}
                onChange={(e) => {
                  const type = (e.target as HTMLSelectElement).value as PolicyScope["type"];
                  if (type === "global") {
                    onUpdate({ scope: { type: "global" } });
                  } else if (type === "category") {
                    onUpdate({ scope: { type: "category", categoryIds: policy.scope.categoryIds ?? [] } });
                  }
                }}
              >
                <option value="global">All Categories</option>
                <option value="category">Specific Categories</option>
              </select>
            </div>
          </div>

          {/* Category selector for specific categories */}
          {policy.scope.type === "category" && (
            <div>
              <label class="label">Select Categories</label>
              <CategorySelector
                categories={categories}
                selectedIds={policy.scope.categoryIds ?? []}
                onChange={(ids) => onUpdate({ scope: { ...policy.scope, categoryIds: ids } })}
                loading={categoriesLoading}
                error={categoriesError}
              />
            </div>
          )}

          {/* Exclude categories for global scope */}
          {policy.scope.type === "global" && categories.length > 0 && (
            <div>
              <details class="text-sm">
                <summary class="cursor-pointer text-primary-600 hover:text-primary-700">
                  {policy.scope.excludeCategories?.length
                    ? `Excluding ${policy.scope.excludeCategories.length} categories`
                    : "Exclude specific categories (optional)"}
                </summary>
                <div class="mt-2">
                  <CategorySelector
                    categories={categories}
                    selectedIds={policy.scope.excludeCategories ?? []}
                    onChange={(ids) => onUpdate({ scope: { ...policy.scope, excludeCategories: ids.length > 0 ? ids : undefined } })}
                    loading={categoriesLoading}
                    error={categoriesError}
                  />
                </div>
              </details>
            </div>
          )}

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="label mb-0">Thresholds</label>
              <button onClick={addThreshold} class="text-sm text-primary-600 hover:text-primary-700">
                + Add Threshold
              </button>
            </div>
            <div class="space-y-2">
              {policy.thresholds.map((threshold, index) => (
                <div key={index} class="flex items-center gap-2">
                  <select
                    class="input w-24"
                    value={threshold.type}
                    onChange={(e) =>
                      updateThreshold(index, { type: (e.target as HTMLSelectElement).value as "percentage" | "absolute" })
                    }
                  >
                    <option value="percentage">%</option>
                    <option value="absolute">$</option>
                  </select>
                  <select
                    class="input w-20"
                    value={threshold.operator}
                    onChange={(e) =>
                      updateThreshold(index, { operator: (e.target as HTMLSelectElement).value as "gte" | "gt" | "eq" })
                    }
                  >
                    <option value="gte">≥</option>
                    <option value="gt">&gt;</option>
                    <option value="eq">=</option>
                  </select>
                  <input
                    type="number"
                    class="input w-24"
                    value={threshold.value}
                    onInput={(e) =>
                      updateThreshold(index, { value: parseFloat((e.target as HTMLInputElement).value) || 0 })
                    }
                  />
                  <input
                    type="text"
                    class="input flex-1"
                    placeholder="Custom message (optional)"
                    value={threshold.message ?? ""}
                    onInput={(e) =>
                      updateThreshold(index, { message: (e.target as HTMLInputElement).value || undefined })
                    }
                  />
                  {policy.thresholds.length > 1 && (
                    <button
                      onClick={() => removeThreshold(index)}
                      class="text-red-500 hover:text-red-700 px-2"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Notification Channels</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policy.channels.includes("email")}
                    onChange={(e) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      const channels = checked
                        ? [...new Set([...policy.channels, "email" as const])]
                        : policy.channels.filter((c) => c !== "email");
                      onUpdate({ channels: channels.length > 0 ? channels : ["email"] });
                    }}
                    class="h-4 w-4 text-primary-600 rounded"
                  />
                  Email
                </label>
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policy.channels.includes("sms")}
                    onChange={(e) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      const channels = checked
                        ? [...new Set([...policy.channels, "sms" as const])]
                        : policy.channels.filter((c) => c !== "sms");
                      onUpdate({ channels: channels.length > 0 ? channels : ["email"] });
                    }}
                    class="h-4 w-4 text-primary-600 rounded"
                  />
                  SMS
                </label>
              </div>
            </div>
            <div>
              <label class="label">Cooldown</label>
              <select
                class="input"
                value={policy.cooldown?.type ?? "once_per_threshold"}
                onChange={(e) =>
                  onUpdate({
                    cooldown: { type: (e.target as HTMLSelectElement).value as "once_per_threshold" | "once_per_day" | "every_check" },
                  })
                }
              >
                <option value="once_per_threshold">Once per threshold</option>
                <option value="once_per_day">Once per day</option>
                <option value="every_check">Every check</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button onClick={onRemove} class="btn-danger text-sm">
              Delete Policy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AlertPolicyEditor({ policies, apiToken, apiBaseUrl, onAdd, onUpdate, onRemove }: AlertPolicyEditorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiToken) {
      setCategories([]);
      return;
    }

    const fetchCategories = async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);

      try {
        const baseUrl = resolveBaseUrl(apiBaseUrl);
        const response = await fetch(`${baseUrl}/categories?format=flattened`, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories ?? []);
        } else {
          const error = await response.text();
          setCategoriesError(`Failed to load categories: ${error}`);
        }
      } catch (err) {
        setCategoriesError(`Failed to load categories: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, [apiToken, apiBaseUrl]);

  return (
    <div class="card mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Alert Policies</h2>
        <button onClick={() => onAdd(createDefaultPolicy())} class="btn-primary text-sm">
          + Add Policy
        </button>
      </div>

      {policies.length === 0 ? (
        <p class="text-gray-500 text-center py-8">
          No alert policies configured. Add one to get started.
        </p>
      ) : (
        <div class="space-y-3">
          {policies.map((policy) => (
            <PolicyForm
              key={policy.id}
              policy={policy}
              categories={categories}
              categoriesLoading={categoriesLoading}
              categoriesError={categoriesError}
              onUpdate={(updates) => onUpdate(policy.id, updates)}
              onRemove={() => onRemove(policy.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
