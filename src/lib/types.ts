export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  urgentTickets: number;
  customers: number;
  lowStock: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  volume: { day: string; created: number; resolved: number }[];
}

export interface AnalyticsReport {
  days: 7 | 30 | 90;
  tickets: number;
  open: number;
  /** Percentage of tickets in range that are resolved/closed; null when there are none. */
  resolutionRate: number | null;
  orders: number;
  revenue: number;
  categories: { name: string; count: number }[];
  channels: { channel: string; orders: number; revenue: number }[];
  generatedAt: string;
}
