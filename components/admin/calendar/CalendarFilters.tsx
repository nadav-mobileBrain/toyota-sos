'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { CalendarFilters, TaskType, TaskStatus } from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client } from '@/types/entity';
import { cn } from '@/lib/utils';

const taskTypes: TaskType[] = [
  'איסוף רכב/שינוע',
  'החזרת רכב/שינוע',
  'מסירת רכב חלופי',
  'הסעת לקוח הביתה',
  'הסעת לקוח למוסך',
  'ביצוע טסט',
  'חילוץ רכב תקוע',
  'אחר',
];

const taskStatuses: TaskStatus[] = ['בהמתנה', 'בעבודה', 'חסומה', 'הושלמה'];

const statusLabels: Record<TaskStatus, string> = {
  בהמתנה: 'ממתינה',
  בעבודה: 'בביצוע',
  חסומה: 'חסומה',
  הושלמה: 'הושלמה',
};

interface CalendarFiltersPanelProps {
  filters: CalendarFilters;
  onFiltersChange: (filters: CalendarFilters) => void;
  drivers: Driver[];
  clients: Client[];
}

export function CalendarFiltersPanel({
  filters,
  onFiltersChange,
  drivers,
  clients,
}: CalendarFiltersPanelProps) {
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        clientInputRef.current &&
        !clientInputRef.current.contains(event.target as Node)
      ) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter clients based on search (min 2 chars)
  const filteredClients = useMemo(() => {
    if (clientSearch.length < 2) return [];
    const searchLower = clientSearch.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) &&
          !filters.clientIds.includes(c.id)
      )
      .slice(0, 10);
  }, [clientSearch, clients, filters.clientIds]);

  const handleTypeToggle = (type: TaskType) => {
    const newTypes = filters.taskTypes.includes(type)
      ? filters.taskTypes.filter((t) => t !== type)
      : [...filters.taskTypes, type];
    onFiltersChange({ ...filters, taskTypes: newTypes });
  };

  const handleStatusToggle = (status: TaskStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleDriverToggle = (driverId: string) => {
    const newDriverIds = filters.driverIds.includes(driverId)
      ? filters.driverIds.filter((id) => id !== driverId)
      : [...filters.driverIds, driverId];
    onFiltersChange({ ...filters, driverIds: newDriverIds });
  };

  const handleAddClient = (clientId: string) => {
    if (!filters.clientIds.includes(clientId)) {
      onFiltersChange({ ...filters, clientIds: [...filters.clientIds, clientId] });
    }
    setClientSearch('');
    setShowClientSuggestions(false);
  };

  const handleRemoveClient = (clientId: string) => {
    onFiltersChange({
      ...filters,
      clientIds: filters.clientIds.filter((id) => id !== clientId),
    });
  };

  const handleClearAll = () => {
    onFiltersChange({
      taskTypes: [],
      statuses: [],
      priorities: [],
      driverIds: [],
      clientIds: [],
    });
    setClientSearch('');
  };

  const hasActiveFilters =
    filters.taskTypes.length > 0 ||
    filters.statuses.length > 0 ||
    filters.driverIds.length > 0 ||
    filters.clientIds.length > 0;

  // Get selected client names for display
  const selectedClients = filters.clientIds
    .map((id) => clients.find((c) => c.id === id))
    .filter(Boolean) as Client[];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">סינון משימות</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-slate-500 hover:text-slate-700"
          >
            <X className="h-4 w-4 ml-1" />
            נקה הכל
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Task Types */}
        <div>
          <Label className="text-xs font-medium text-slate-600 mb-2 block">
            סוג משימה
          </Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {taskTypes.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={filters.taskTypes.includes(type)}
                  onCheckedChange={() => handleTypeToggle(type)}
                />
                <label
                  htmlFor={`type-${type}`}
                  className="text-sm text-slate-700 cursor-pointer"
                >
                  {type}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Statuses */}
        <div>
          <Label className="text-xs font-medium text-slate-600 mb-2 block">
            סטטוס
          </Label>
          <div className="space-y-2">
            {taskStatuses.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <Checkbox
                  id={`status-${status}`}
                  checked={filters.statuses.includes(status)}
                  onCheckedChange={() => handleStatusToggle(status)}
                />
                <label
                  htmlFor={`status-${status}`}
                  className="text-sm text-slate-700 cursor-pointer"
                >
                  {statusLabels[status]}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Drivers */}
        <div>
          <Label className="text-xs font-medium text-slate-600 mb-2 block">
            נהג
          </Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {drivers.map((driver) => (
              <div key={driver.id} className="flex items-center gap-2">
                <Checkbox
                  id={`driver-${driver.id}`}
                  checked={filters.driverIds.includes(driver.id)}
                  onCheckedChange={() => handleDriverToggle(driver.id)}
                />
                <label
                  htmlFor={`driver-${driver.id}`}
                  className="text-sm text-slate-700 cursor-pointer truncate"
                >
                  {driver.name || driver.email}
                </label>
              </div>
            ))}
            {drivers.length === 0 && (
              <p className="text-xs text-slate-400">אין נהגים</p>
            )}
          </div>
        </div>

        {/* Clients - Autocomplete */}
        <div>
          <Label className="text-xs font-medium text-slate-600 mb-2 block">
            לקוח
          </Label>
          <div className="relative">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                ref={clientInputRef}
                type="text"
                placeholder="חפש לקוח (לפחות 2 תווים)..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientSuggestions(e.target.value.length >= 2);
                }}
                onFocus={() => {
                  if (clientSearch.length >= 2) {
                    setShowClientSuggestions(true);
                  }
                }}
                className="pr-8 text-sm"
              />
            </div>

            {/* Suggestions dropdown */}
            {showClientSuggestions && filteredClients.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleAddClient(client.id)}
                    className={cn(
                      'w-full px-3 py-2 text-right text-sm hover:bg-slate-100 transition-colors',
                      'border-b border-slate-100 last:border-b-0'
                    )}
                  >
                    {client.name}
                  </button>
                ))}
              </div>
            )}

            {showClientSuggestions &&
              clientSearch.length >= 2 &&
              filteredClients.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3">
                  <p className="text-xs text-slate-400 text-center">
                    לא נמצאו לקוחות
                  </p>
                </div>
              )}
          </div>

          {/* Selected clients */}
          {selectedClients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedClients.map((client) => (
                <Badge
                  key={client.id}
                  variant="secondary"
                  className="text-xs pl-1 pr-2 py-0.5 gap-1"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveClient(client.id)}
                    className="hover:bg-slate-300 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {client.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

