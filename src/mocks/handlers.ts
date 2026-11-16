import { http, HttpResponse, delay } from 'msw';
import {
  CARRIERS,
  CATEGORIES,
  ORDER_STATUSES,
  RETURN_STATUSES,
  SHIPMENT_FLOW,
  SHIPMENT_STAGES,
  type Order,
  type OrderChannel,
  type OrderLine,
  type Product,
  type ReturnRequest,
  type ReturnStatus,
  type ShipmentEvent,
  type ShipmentStage,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from './data';
import { mockConfig } from './config';
import { createPdf } from './pdf';
import { StoreError, store, type CollectionName, type ReadTx, type WriteTx } from './store';

// All data access goes through `store` (see ./store). Handlers never touch the
// storage engine directly, so it can be swapped without changing this file.

// ----- response helpers --------------------------------------------------------

const ok = <T>(data: T) => HttpResponse.json(data as object);
const fail = (status: number, message: string) => HttpResponse.json({ message }, { status });

/** Run a write; storage failures become a 503 instead of an unhandled error. */
async function write(fn: (tx: WriteTx) => Response): Promise<Response> {
  try {
    return await store.write(fn);
  } catch (err) {
    if (err instanceof StoreError) return fail(503, err.message);
    throw err;
  }
}

const read = <T>(fn: (tx: ReadTx) => T) => store.read(fn);

/** Parse a JSON body; a missing or malformed body becomes an empty object. */
async function jsonBody<T extends object>(request: Request): Promise<Partial<T>> {
  const body: unknown = await request.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Partial<T>) : {};
}

const now = () => new Date().toISOString();
const round2 = (n: number) => Math.round(n * 100) / 100;
const fakerCarrier = () => CARRIERS[Math.floor(Math.random() * CARRIERS.length)];

const TICKET_STATUSES: TicketStatus[] = ['open', 'pending', 'resolved', 'closed'];
const TICKET_PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
const ORDER_CHANNELS: OrderChannel[] = ['web', 'phone', 'email', 'partner'];

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

const isNonNegativeInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function isValidDate(v: unknown): v is string {
  return typeof v === 'string' && v !== '' && !Number.isNaN(Date.parse(v));
}

/** Accept tags as an array or a comma-separated string; always store string[]. */
function normalizeTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return [...new Set(list.map((t) => String(t).trim()).filter(Boolean))].slice(0, 20);
}

// Tickets and orders can be addressed by their internal id OR their public ref
// (e.g. the dashboard activity feed links to /tickets/TCK-1234).
function findByIdOrRef<K extends 'tickets' | 'orders'>(tx: ReadTx, name: K, param: unknown) {
  return tx.find(name, (x) => x.id === param || x.ref === param);
}

/** A ref like TCK-1234 that no record in the collection uses yet. */
function uniqueRef(tx: ReadTx, name: CollectionName, prefix: string, min: number, max: number): string {
  const used = new Set(tx.all(name).map((r) => (r as { ref?: string }).ref));
  for (let i = 0; i < 50; i++) {
    const ref = `${prefix}-${Math.floor(min + Math.random() * (max - min + 1))}`;
    if (!used.has(ref)) return ref;
  }
  // Practically unreachable: fall back to the first free number.
  for (let n = min; n <= max; n++) if (!used.has(`${prefix}-${n}`)) return `${prefix}-${n}`;
  return `${prefix}-${Date.now()}`;
}

// Rolling counter for the Challenge Lab rate-limit endpoint.
let rateLimitHits = 0;

async function sim(delayOverride?: number) {
  const ms = delayOverride ?? mockConfig.latencyMs;
  if (ms > 0) await delay(ms);
  return Math.random() < mockConfig.failureRate;
}

/** Read page/pageSize safely: invalid or out-of-range values are clamped. */
function pageParams(url: URL) {
  const rawPage = Number(url.searchParams.get('page') ?? 1);
  const rawSize = Number(url.searchParams.get('pageSize') ?? mockConfig.pageSize);
  return {
    page: Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1,
    pageSize: Number.isFinite(rawSize) ? Math.min(500, Math.max(1, Math.floor(rawSize))) : mockConfig.pageSize,
  };
}

function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: current,
    pageSize,
    totalPages,
  };
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

function csvResponse(filename: string, csv: string) {
  return new HttpResponse('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function sortBy<T>(items: readonly T[], field: string, dir: 1 | -1): T[] {
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[field];
    const bv = (b as Record<string, unknown>)[field];
    if (av == null || bv == null) return 0;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function filterTickets(tx: ReadTx, url: URL): Ticket[] {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const statuses = url.searchParams.getAll('status');
  const priorities = url.searchParams.getAll('priority');
  const categories = url.searchParams.getAll('category');
  const assignees = url.searchParams.getAll('assignee');
  const customerId = url.searchParams.get('customerId');

  const items = tx.filter('tickets', (t) => {
    if (statuses.length && !statuses.includes(t.status)) return false;
    if (priorities.length && !priorities.includes(t.priority)) return false;
    if (categories.length && !categories.includes(t.category)) return false;
    if (assignees.length && !assignees.includes(t.assignee)) return false;
    if (customerId && t.customerId !== customerId) return false;
    if (q) {
      const hay = `${t.ref} ${t.subject} ${t.customerName} ${t.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const dir = url.searchParams.get('dir') === 'asc' ? 1 : -1;
  return sortBy(items, url.searchParams.get('sort') ?? 'updatedAt', dir);
}

function filterOrders(tx: ReadTx, url: URL): Order[] {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const statuses = url.searchParams.getAll('status');
  const payment = url.searchParams.get('payment');
  const channel = url.searchParams.get('channel');
  const customerId = url.searchParams.get('customerId');

  const items = tx.filter('orders', (o) => {
    if (statuses.length && !statuses.includes(o.status)) return false;
    if (payment && o.paymentStatus !== payment) return false;
    if (channel && o.channel !== channel) return false;
    if (customerId && o.customerId !== customerId) return false;
    if (q && !`${o.ref} ${o.customerName} ${o.trackingNumber ?? ''}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
  const dir = url.searchParams.get('dir') === 'asc' ? 1 : -1;
  return sortBy(items, url.searchParams.get('sort') ?? 'createdAt', dir);
}

function filterProducts(tx: ReadTx, url: URL): Product[] {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const category = url.searchParams.get('category');
  const warehouse = url.searchParams.get('warehouse');
  const lowStock = url.searchParams.get('lowStock') === 'true';
  return tx.filter('products', (p) => {
    if (category && p.category !== category) return false;
    if (warehouse && p.warehouse !== warehouse) return false;
    if (lowStock && p.stock > p.reorderLevel) return false;
    if (q && !`${p.name} ${p.sku}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Shipment events for an order, oldest first. */
function shipmentEvents(tx: ReadTx, orderId: string): ShipmentEvent[] {
  return tx.filter('shipments', (s) => s.orderId === orderId).sort((a, b) => a.at.localeCompare(b.at));
}

/** The furthest regular stage reached (ignores 'exception' events). */
function currentFlowStage(events: ShipmentEvent[]): ShipmentStage | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (SHIPMENT_FLOW.includes(events[i].stage)) return events[i].stage;
  }
  return undefined;
}

// ----- field whitelists for PATCH ------------------------------------------------

/** Validate a ticket patch. Returns the clean patch or an error message. */
function ticketPatch(body: Record<string, unknown>): Partial<Ticket> | string {
  const patch: Partial<Ticket> = {};
  if ('subject' in body) {
    if (typeof body.subject !== 'string' || body.subject.trim().length < 4) return 'Subject must be at least 4 characters';
    patch.subject = body.subject.trim();
  }
  if ('description' in body) patch.description = String(body.description ?? '');
  if ('status' in body) {
    if (!isOneOf(TICKET_STATUSES, body.status)) return `Invalid status "${String(body.status)}"`;
    patch.status = body.status;
  }
  if ('priority' in body) {
    if (!isOneOf(TICKET_PRIORITIES, body.priority)) return `Invalid priority "${String(body.priority)}"`;
    patch.priority = body.priority;
  }
  if ('category' in body) {
    if (typeof body.category !== 'string' || !body.category.trim()) return 'Invalid category';
    patch.category = body.category.trim();
  }
  if ('assignee' in body) {
    if (typeof body.assignee !== 'string' || !body.assignee.trim()) return 'Invalid assignee';
    patch.assignee = body.assignee.trim();
  }
  if ('tags' in body) patch.tags = normalizeTags(body.tags);
  if ('dueDate' in body) {
    if (!isValidDate(body.dueDate)) return 'Invalid due date';
    patch.dueDate = new Date(body.dueDate).toISOString();
  }
  return patch;
}

function productPatch(body: Record<string, unknown>): Partial<Product> | string {
  const patch: Partial<Product> = {};
  if ('stock' in body) {
    if (!isNonNegativeInt(body.stock) || body.stock > 1_000_000) return 'Stock must be a whole number from 0 to 1,000,000';
    patch.stock = body.stock;
  }
  if ('reorderLevel' in body) {
    if (!isNonNegativeInt(body.reorderLevel)) return 'Reorder level must be a whole number of 0 or more';
    patch.reorderLevel = body.reorderLevel;
  }
  if ('price' in body) {
    if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) return 'Price must be a number of 0 or more';
    patch.price = round2(body.price);
  }
  return patch;
}

const isEmpty = (o: object) => Object.keys(o).length === 0;

/** Allowed RMA moves. Anything else (e.g. a stale tab rejecting a refunded return) is a 409. */
const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: ['refunded'],
  rejected: [],
  refunded: [],
};

export const handlers = [
  // ----- Config introspection (handy for a health check) --------------------
  http.get('/api/_config', async () => {
    await delay(60);
    return ok({ ...mockConfig });
  }),

  // ----- Admin: restore the seed data for every tab ---------------------------
  http.post('/api/admin/reset-data', async () => {
    await delay(300);
    try {
      await store.reset();
      return ok({ ok: true, resetAt: now() });
    } catch (err) {
      return fail(503, err instanceof Error ? err.message : 'Could not reset data');
    }
  }),

  // ----- Tickets ------------------------------------------------------------
  http.get('/api/tickets', async ({ request }) => {
    if (await sim()) return fail(500, 'Failed to load tickets');
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    return ok(await read((tx) => paginate(filterTickets(tx, url), page, pageSize)));
  }),

  // Must be declared before '/api/tickets/:id' so it is not captured as an id.
  http.get('/api/tickets/export.csv', async ({ request }) => {
    if (await sim(500)) return fail(500, 'Export failed');
    const url = new URL(request.url);
    const items = await read((tx) => filterTickets(tx, url));
    const csv = toCsv(
      ['Ref', 'Subject', 'Status', 'Priority', 'Category', 'Customer', 'Assignee', 'Updated'],
      items.map((t) => [t.ref, t.subject, t.status, t.priority, t.category, t.customerName, t.assignee, t.updatedAt.slice(0, 10)]),
    );
    return csvResponse(`tickets-${now().slice(0, 10)}.csv`, csv);
  }),

  http.get('/api/tickets/:id', async ({ params }) => {
    if (await sim()) return fail(500, 'Ticket not found');
    const result = await read((tx) => {
      const ticket = findByIdOrRef(tx, 'tickets', params.id);
      return ticket && { ticket, comments: tx.filter('comments', (c) => c.ticketId === ticket.id) };
    });
    return result ? ok(result) : fail(404, 'Ticket not found');
  }),

  http.post('/api/tickets', async ({ request }) => {
    if (await sim()) return fail(500, 'Could not create ticket');
    const body = await jsonBody<Ticket>(request);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    if (subject.length < 4) return fail(422, 'Subject must be at least 4 characters');
    if (body.status !== undefined && !isOneOf(TICKET_STATUSES, body.status)) return fail(422, 'Invalid status');
    if (body.priority !== undefined && !isOneOf(TICKET_PRIORITIES, body.priority)) return fail(422, 'Invalid priority');
    if (body.dueDate !== undefined && body.dueDate !== '' && !isValidDate(body.dueDate)) return fail(422, 'Invalid due date');

    return write((tx) => {
      const customer = body.customerId ? tx.get('customers', body.customerId) : tx.all('customers')[0];
      if (!customer) return fail(422, 'Customer not found');
      const ts = now();
      const ticket: Ticket = {
        id: crypto.randomUUID(),
        ref: uniqueRef(tx, 'tickets', 'TCK', 1000, 9999),
        subject,
        description: typeof body.description === 'string' ? body.description : '',
        status: body.status ?? 'open',
        priority: body.priority ?? 'medium',
        category: typeof body.category === 'string' && body.category ? body.category : CATEGORIES[1],
        customerId: customer.id,
        customerName: customer.name,
        assignee: typeof body.assignee === 'string' && body.assignee ? body.assignee : 'Unassigned',
        tags: normalizeTags(body.tags),
        attachments: 0,
        createdAt: ts,
        updatedAt: ts,
        dueDate: isValidDate(body.dueDate) ? new Date(body.dueDate).toISOString() : ts,
      };
      tx.insert('tickets', ticket, { at: 'start' });
      tx.update('customers', customer.id, { totalTickets: customer.totalTickets + 1 });
      return ok(ticket);
    });
  }),

  http.patch('/api/tickets/:id', async ({ params, request }) => {
    if (await sim()) return fail(500, 'Could not update ticket');
    const patch = ticketPatch(await jsonBody(request));
    if (typeof patch === 'string') return fail(422, patch);
    return write((tx) => {
      const ticket = findByIdOrRef(tx, 'tickets', params.id);
      if (!ticket) return fail(404, 'Ticket not found');
      if (isEmpty(patch)) return ok(ticket);
      return ok(tx.update('tickets', ticket.id, { ...patch, updatedAt: now() }));
    });
  }),

  http.delete('/api/tickets/:id', async ({ params }) => {
    if (await sim()) return fail(500, 'Could not delete ticket');
    return write((tx) => {
      const ticket = findByIdOrRef(tx, 'tickets', params.id);
      if (!ticket) return fail(404, 'Ticket not found');
      tx.remove('tickets', ticket.id);
      // Remove everything that only makes sense with the ticket.
      tx.removeWhere('comments', (c) => c.ticketId === ticket.id);
      tx.removeWhere('activity', (a) => a.target === ticket.ref);
      const customer = tx.get('customers', ticket.customerId);
      if (customer) tx.update('customers', customer.id, { totalTickets: Math.max(0, customer.totalTickets - 1) });
      return ok({ ok: true });
    });
  }),

  http.get('/api/tickets/:id/comments', async ({ params }) => {
    await delay(120);
    return ok(
      await read((tx) => {
        const ticket = findByIdOrRef(tx, 'tickets', params.id);
        return ticket ? tx.filter('comments', (c) => c.ticketId === ticket.id) : [];
      }),
    );
  }),

  http.post('/api/tickets/:id/comments', async ({ params, request }) => {
    if (await sim()) return fail(500, 'Could not add comment');
    const body = await jsonBody<{ body: string; internal: boolean }>(request);
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (text.length < 2) return fail(422, 'Comment is too short');
    if (text.length > 10_000) return fail(422, 'Comment is too long');
    return write((tx) => {
      const ticket = findByIdOrRef(tx, 'tickets', params.id);
      if (!ticket) return fail(404, 'Ticket not found');
      const ts = now();
      const comment = {
        id: crypto.randomUUID(),
        ticketId: ticket.id,
        author: 'You',
        body: text,
        createdAt: ts,
        internal: !!body.internal,
      };
      tx.insert('comments', comment);
      tx.update('tickets', ticket.id, { updatedAt: ts });
      return ok(comment);
    });
  }),

  // ----- Customers ----------------------------------------------------------
  http.get('/api/customers', async ({ request }) => {
    if (await sim()) return fail(500, 'Failed to load customers');
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const plan = url.searchParams.get('plan');
    const status = url.searchParams.get('status');
    const { page, pageSize } = pageParams(url);
    const items = await read((tx) =>
      tx.filter('customers', (c) => {
        if (plan && c.plan !== plan) return false;
        if (status && c.status !== status) return false;
        if (q && !`${c.name} ${c.email} ${c.company}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    );
    return ok(paginate(items, page, pageSize));
  }),

  http.get('/api/customers/:id', async ({ params }) => {
    if (await sim()) return fail(500, 'Customer not found');
    const result = await read((tx) => {
      const customer = tx.get('customers', String(params.id));
      return customer && { customer, tickets: tx.filter('tickets', (t) => t.customerId === customer.id).slice(0, 10) };
    });
    return result ? ok(result) : fail(404, 'Customer not found');
  }),

  // ----- Inventory ----------------------------------------------------------
  http.get('/api/inventory', async ({ request }) => {
    if (await sim()) return fail(500, 'Failed to load inventory');
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    return ok(
      await read((tx) => ({
        ...paginate(filterProducts(tx, url), page, pageSize),
        categories: [...new Set(tx.all('products').map((p) => p.category))],
        warehouses: [...new Set(tx.all('products').map((p) => p.warehouse))],
      })),
    );
  }),

  http.patch('/api/inventory/:id', async ({ params, request }) => {
    if (await sim()) return fail(500, 'Could not update stock');
    const patch = productPatch(await jsonBody(request));
    if (typeof patch === 'string') return fail(422, patch);
    return write((tx) => {
      const product = tx.get('products', String(params.id));
      if (!product) return fail(404, 'Product not found');
      if (isEmpty(patch)) return ok(product);
      return ok(tx.update('products', product.id, { ...patch, updatedAt: now() }));
    });
  }),

  http.get('/api/inventory/export.csv', async ({ request }) => {
    if (await sim(500)) return fail(500, 'Export failed');
    const url = new URL(request.url);
    const items = await read((tx) => filterProducts(tx, url));
    const csv = toCsv(
      ['SKU', 'Name', 'Category', 'Warehouse', 'Price', 'Stock', 'Reorder Level'],
      items.map((p) => [p.sku, p.name, p.category, p.warehouse, p.price.toFixed(2), p.stock, p.reorderLevel]),
    );
    const suffix = url.searchParams.get('lowStock') === 'true' ? 'low-stock' : 'all';
    return csvResponse(`inventory-${suffix}-${now().slice(0, 10)}.csv`, csv);
  }),

  // ----- Orders & fulfillment ----------------------------------------------
  http.get('/api/orders', async ({ request }) => {
    if (await sim()) return fail(500, 'Failed to load orders');
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    return ok(
      await read((tx) => ({
        ...paginate(filterOrders(tx, url), page, pageSize),
        counts: ORDER_STATUSES.reduce<Record<string, number>>((acc, s) => {
          acc[s] = tx.filter('orders', (o) => o.status === s).length;
          return acc;
        }, {}),
      })),
    );
  }),

  http.get('/api/orders/export.csv', async ({ request }) => {
    if (await sim(500)) return fail(500, 'Export failed');
    const url = new URL(request.url);
    const items = await read((tx) => filterOrders(tx, url));
    const csv = toCsv(
      ['Ref', 'Customer', 'Items', 'Currency', 'Subtotal', 'Shipping', 'Tax', 'Total', 'Payment', 'Status', 'Channel', 'Created'],
      items.map((o) => [
        o.ref,
        o.customerName,
        String(o.items.length),
        o.currency,
        o.subtotal.toFixed(2),
        o.shipping.toFixed(2),
        o.tax.toFixed(2),
        o.total.toFixed(2),
        o.paymentStatus,
        o.status,
        o.channel,
        o.createdAt.slice(0, 10),
      ]),
    );
    return csvResponse(`orders-${now().slice(0, 10)}.csv`, csv);
  }),

  http.get('/api/orders/:id', async ({ params }) => {
    if (await sim()) return fail(500, 'Order not found');
    const result = await read((tx) => {
      const order = findByIdOrRef(tx, 'orders', params.id);
      return (
        order && {
          order,
          shipments: shipmentEvents(tx, order.id),
          returns: tx.filter('returns', (r) => r.orderId === order.id),
        }
      );
    });
    return result ? ok(result) : fail(404, 'Order not found');
  }),

  http.post('/api/orders', async ({ request }) => {
    if (await sim()) return fail(500, 'Could not create order');
    const body = await jsonBody<Order & { items: OrderLine[] }>(request);
    if (!body.customerId) return fail(422, 'Select a customer');
    if (!Array.isArray(body.items) || body.items.length === 0) return fail(422, 'Add at least one line item');
    if (body.items.some((it) => typeof it?.quantity !== 'number' || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 999)) {
      return fail(422, 'Each quantity must be a whole number from 1 to 999');
    }
    const requested = body.items;

    return write((tx) => {
      const customer = tx.get('customers', String(body.customerId));
      if (!customer) return fail(422, 'Customer not found');

      // Merge repeated products into one line; prices come from the catalog, not the client.
      const lines = new Map<string, OrderLine>();
      for (const it of requested) {
        const product = tx.get('products', String(it.productId));
        if (!product) return fail(422, `Unknown product "${String(it.productId)}"`);
        const existing = lines.get(product.id);
        const quantity = (existing?.quantity ?? 0) + Number(it.quantity);
        lines.set(product.id, { productId: product.id, sku: product.sku, name: product.name, quantity, unitPrice: product.price });
      }
      const items = [...lines.values()];
      const subtotal = round2(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0));
      const shipping = subtotal > 150 ? 0 : 9.95;
      const tax = round2(subtotal * 0.21);
      const ts = now();
      const order: Order = {
        id: crypto.randomUUID(),
        ref: uniqueRef(tx, 'orders', 'ORD', 10000, 99999),
        customerId: customer.id,
        customerName: customer.name,
        status: 'pending',
        paymentStatus: 'pending',
        channel: isOneOf(ORDER_CHANNELS, body.channel) ? body.channel : 'web',
        items,
        subtotal,
        shipping,
        tax,
        total: round2(subtotal + shipping + tax),
        currency: 'EUR',
        shippingAddress: typeof body.shippingAddress === 'string' ? body.shippingAddress : '',
        notes: typeof body.notes === 'string' ? body.notes : '',
        createdAt: ts,
        updatedAt: ts,
      };
      tx.insert('orders', order, { at: 'start' });
      return ok(order);
    });
  }),

  http.patch('/api/orders/:id', async ({ params, request }) => {
    if (await sim()) return fail(500, 'Could not update order');
    const body = await jsonBody<Order>(request);
    // Status, payment and totals change only through the dedicated actions below.
    const patch: Partial<Order> = {};
    if ('notes' in body) patch.notes = String(body.notes ?? '');
    if ('shippingAddress' in body) patch.shippingAddress = String(body.shippingAddress ?? '');
    return write((tx) => {
      const order = findByIdOrRef(tx, 'orders', params.id);
      if (!order) return fail(404, 'Order not found');
      if (isEmpty(patch)) return ok(order);
      return ok(tx.update('orders', order.id, { ...patch, updatedAt: now() }));
    });
  }),

  http.post('/api/orders/:id/ship', async ({ params, request }) => {
    if (await sim()) return fail(500, 'Could not create shipment');
    const body = await jsonBody<{ carrier: string; trackingNumber: string }>(request);
    return write((tx) => {
      const order = findByIdOrRef(tx, 'orders', params.id);
      if (!order) return fail(404, 'Order not found');
      if (order.status !== 'pending' && order.status !== 'processing') {
        return fail(409, `A ${order.status} order can't be shipped`);
      }
      const carrier = typeof body.carrier === 'string' && body.carrier ? body.carrier : fakerCarrier();
      const trackingNumber =
        typeof body.trackingNumber === 'string' && body.trackingNumber
          ? body.trackingNumber
          : Math.random().toString(36).slice(2, 13).toUpperCase();
      const ts = now();
      const updated = tx.update('orders', order.id, {
        status: 'shipped',
        paymentStatus: order.paymentStatus === 'pending' ? 'paid' : order.paymentStatus,
        carrier,
        trackingNumber,
        updatedAt: ts,
      });
      const event: ShipmentEvent = {
        id: crypto.randomUUID(),
        orderId: order.id,
        orderRef: order.ref,
        stage: 'label_created',
        carrier,
        trackingNumber,
        location: 'Fulfillment center',
        note: 'Shipping label created',
        at: ts,
      };
      tx.insert('shipments', event);
      return ok({ order: updated, event });
    });
  }),

  http.post('/api/orders/:id/advance', async ({ params, request }) => {
    if (await sim()) return fail(500, 'Could not advance shipment');
    const body = await jsonBody<{ stage: ShipmentStage }>(request);
    if (body.stage !== undefined && !isOneOf(SHIPMENT_STAGES, body.stage)) return fail(422, 'Invalid shipment stage');
    return write((tx) => {
      const order = findByIdOrRef(tx, 'orders', params.id);
      if (!order) return fail(404, 'Order not found');
      if (order.status === 'cancelled' || order.status === 'refunded') {
        return fail(409, `A ${order.status} order can't be shipped`);
      }
      // Progress from the furthest regular stage, so an 'exception' doesn't send
      // the parcel back to the start; with no events yet, the first stage is a label.
      // Only one step forward (or an exception once shipped) is allowed, so a
      // stale tab can't skip stages or move a delivered parcel backwards.
      const current = currentFlowStage(shipmentEvents(tx, order.id));
      if (current === 'delivered' || order.status === 'delivered') {
        return fail(409, 'This order has already been delivered');
      }
      const expected: ShipmentStage = current ? SHIPMENT_FLOW[SHIPMENT_FLOW.indexOf(current) + 1] : 'label_created';
      if (body.stage === 'exception' && !current) return fail(409, 'Ship the order before reporting an exception');
      if (body.stage !== undefined && body.stage !== 'exception' && body.stage !== expected) {
        return fail(409, `The next stage is ${expected.replace(/_/g, ' ')}`);
      }
      const next: ShipmentStage = body.stage ?? expected;
      const ts = now();
      const carrier = order.carrier ?? fakerCarrier();
      const trackingNumber = order.trackingNumber ?? Math.random().toString(36).slice(2, 13).toUpperCase();
      const event: ShipmentEvent = {
        id: crypto.randomUUID(),
        orderId: order.id,
        orderRef: order.ref,
        stage: next,
        carrier,
        trackingNumber,
        location: next === 'label_created' ? 'Fulfillment center' : 'Sorting facility',
        note: `Shipment ${next.replace(/_/g, ' ')}`,
        at: ts,
      };
      tx.insert('shipments', event);
      tx.update('orders', order.id, {
        carrier,
        trackingNumber,
        status: next === 'delivered' ? 'delivered' : 'shipped',
        paymentStatus: order.paymentStatus === 'pending' ? 'paid' : order.paymentStatus,
        updatedAt: ts,
      });
      return ok(event);
    });
  }),

  http.post('/api/orders/:id/reset-shipment', async ({ params }) => {
    if (await sim()) return fail(500, 'Could not reset shipment');
    return write((tx) => {
      const order = findByIdOrRef(tx, 'orders', params.id);
      if (!order) return fail(404, 'Order not found');
      if (order.status === 'cancelled' || order.status === 'refunded') {
        return fail(409, `A ${order.status} order has no shipment to reset`);
      }
      if (tx.find('returns', (r) => r.orderId === order.id)) {
        return fail(409, 'This order has a return; its tracking can no longer be reset');
      }
      tx.removeWhere('shipments', (s) => s.orderId === order.id);
      return ok(
        tx.update('orders', order.id, {
          status: 'processing',
          carrier: undefined,
          trackingNumber: undefined,
          updatedAt: now(),
        }),
      );
    });
  }),

  http.post('/api/orders/:id/refund', async ({ params }) => {
    if (await sim()) return fail(500, 'Could not refund order');
    return write((tx) => {
      const order = findByIdOrRef(tx, 'orders', params.id);
      if (!order) return fail(404, 'Order not found');
      if (order.paymentStatus !== 'paid' || order.status === 'refunded') {
        return fail(409, 'Only paid orders can be refunded');
      }
      return ok(tx.update('orders', order.id, { status: 'refunded', paymentStatus: 'refunded', updatedAt: now() }));
    });
  }),

  http.post('/api/orders/:id/cancel', async ({ params }) => {
    if (await sim()) return fail(500, 'Could not cancel order');
    return write((tx) => {
      const order = findByIdOrRef(tx, 'orders', params.id);
      if (!order) return fail(404, 'Order not found');
      if (order.status !== 'pending' && order.status !== 'processing') {
        return fail(409, `A ${order.status} order can't be cancelled`);
      }
      return ok(tx.update('orders', order.id, { status: 'cancelled', updatedAt: now() }));
    });
  }),

  // ----- Shipments (fulfillment queue) --------------------------------------
  http.get('/api/shipments', async ({ request }) => {
    if (await sim()) return fail(500, 'Failed to load shipments');
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const carrier = url.searchParams.get('carrier');
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const { page, pageSize } = pageParams(url);
    const queue = await read((tx) =>
      tx
        .filter('orders', (o) => ['processing', 'shipped', 'delivered'].includes(o.status))
        .map((o) => {
          const events = shipmentEvents(tx, o.id);
          const latest = events[events.length - 1];
          return {
            orderId: o.id,
            orderRef: o.ref,
            customerName: o.customerName,
            status: o.status,
            carrier: o.carrier ?? '—',
            trackingNumber: o.trackingNumber ?? '—',
            stage: latest?.stage ?? 'not_shipped',
            location: latest?.location ?? '—',
            items: o.items.reduce((s, it) => s + it.quantity, 0),
            updatedAt: o.updatedAt,
          };
        })
        .filter((row) => {
          if (status && row.status !== status) return false;
          if (carrier && row.carrier !== carrier) return false;
          if (q && !`${row.orderRef} ${row.customerName} ${row.trackingNumber}`.toLowerCase().includes(q)) {
            return false;
          }
          return true;
        }),
    );
    return ok({ ...paginate(queue, page, pageSize), carriers: CARRIERS });
  }),

  // ----- Returns / RMA ------------------------------------------------------
  http.get('/api/returns', async ({ request }) => {
    if (await sim()) return fail(500, 'Failed to load returns');
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const { page, pageSize } = pageParams(url);
    return ok(
      await read((tx) => {
        const items = tx
          .filter('returns', (r) => {
            if (status && r.status !== status) return false;
            if (q && !`${r.ref} ${r.orderRef} ${r.customerName} ${r.reason}`.toLowerCase().includes(q)) {
              return false;
            }
            return true;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return {
          ...paginate(items, page, pageSize),
          counts: RETURN_STATUSES.reduce<Record<string, number>>((acc, s) => {
            acc[s] = tx.filter('returns', (r) => r.status === s).length;
            return acc;
          }, {}),
        };
      }),
    );
  }),

  http.post('/api/returns', async ({ request }) => {
    if (await sim()) return fail(500, 'Could not create return');
    const body = await jsonBody<{ orderId: string; reason: string }>(request);
    return write((tx) => {
      const order = findByIdOrRef(tx, 'orders', body.orderId);
      if (!order) return fail(404, 'Order not found');
      if (order.status !== 'delivered') return fail(409, 'Only delivered orders can be returned');
      if (tx.find('returns', (r) => r.orderId === order.id)) return fail(409, 'A return already exists for this order');
      const ts = now();
      const ret: ReturnRequest = {
        id: crypto.randomUUID(),
        ref: uniqueRef(tx, 'returns', 'RMA', 1000, 9999),
        orderId: order.id,
        orderRef: order.ref,
        customerName: order.customerName,
        reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'No longer needed',
        status: 'requested',
        amount: order.total,
        createdAt: ts,
        updatedAt: ts,
      };
      tx.insert('returns', ret, { at: 'start' });
      return ok(ret);
    });
  }),

  http.patch('/api/returns/:id', async ({ params, request }) => {
    if (await sim()) return fail(500, 'Could not update return');
    const body = await jsonBody<{ status: ReturnStatus }>(request);
    if (!isOneOf(RETURN_STATUSES, body.status)) return fail(422, 'Invalid return status');
    const status = body.status;
    return write((tx) => {
      const ret = tx.get('returns', String(params.id));
      if (!ret) return fail(404, 'Return not found');
      if (ret.status === status) return ok(ret);
      if (!RETURN_TRANSITIONS[ret.status].includes(status)) {
        return fail(409, `A ${ret.status} return can't be marked ${status}`);
      }
      return ok(tx.update('returns', ret.id, { status, updatedAt: now() }));
    });
  }),

  // ----- Reports ------------------------------------------------------------
  http.post('/api/reports/generate', async ({ request }) => {
    if (await sim(900)) return fail(500, 'Report generation failed');
    const body = await jsonBody<{ type: string }>(request);
    return ok({
      id: crypto.randomUUID(),
      name: `${typeof body.type === 'string' && body.type ? body.type : 'summary'}-report-${now().slice(0, 10)}.pdf`,
    });
  }),

  http.get('/api/reports/:name.pdf', async ({ params }) => {
    if (await sim(500)) return fail(500, 'Report not found');
    const lines = await read((tx) =>
      tx
        .all('tickets')
        .slice(0, 30)
        .map((t) => `${t.ref}  ${t.status.padEnd(9)}  ${t.customerName}`),
    );
    // The minimal PDF writer is ASCII-only, so keep the title plain ASCII.
    const pdf = createPdf(`TestDesk Report - ${params.name}`, [`Generated: ${now()}`, '', ...lines]);
    return new HttpResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${params.name}.pdf"`,
      },
    });
  }),

  // ----- Uploads ------------------------------------------------------------
  http.post('/api/uploads', async ({ request }) => {
    if (await sim(600)) return fail(500, 'Upload failed');
    const form = await request.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return fail(422, 'No files provided');
    const maxBytes = 5 * 1024 * 1024;
    const allowed = ['image/png', 'image/jpeg', 'application/pdf', 'text/csv'];
    for (const f of files) {
      if (f.size > maxBytes) return fail(413, `"${f.name}" exceeds the 5 MB limit`);
      if (f.type && !allowed.includes(f.type)) {
        return fail(415, `"${f.name}" has an unsupported type (${f.type})`);
      }
    }
    return ok({
      ok: true,
      files: files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        url: `/files/${encodeURIComponent(f.name)}`,
      })),
    });
  }),

  // ----- Notifications & activity ------------------------------------------
  http.get('/api/notifications', async () => {
    await delay(150);
    return ok(await read((tx) => tx.all('notifications')));
  }),

  http.post('/api/notifications/:id/read', async ({ params }) => {
    return write((tx) => {
      const n = tx.get('notifications', String(params.id));
      if (!n) return fail(404, 'Notification not found');
      if (!n.read) tx.update('notifications', n.id, { read: true });
      return ok({ ok: true });
    });
  }),

  http.post('/api/notifications/read-all', async () => {
    return write((tx) => {
      for (const n of tx.all('notifications')) if (!n.read) tx.update('notifications', n.id, { read: true });
      return ok({ ok: true });
    });
  }),

  http.get('/api/activity', async () => {
    await delay(120);
    return ok(await read((tx) => tx.all('activity')));
  }),

  // ----- Dashboard stats ----------------------------------------------------
  http.get('/api/stats', async () => {
    if (await sim()) return fail(500, 'Failed to load stats');
    return ok(
      await read((tx) => {
        const tickets = tx.all('tickets');
        const countBy = (key: 'status' | 'priority' | 'category') =>
          tickets.reduce<Record<string, number>>((acc, t) => {
            acc[t[key]] = (acc[t[key]] ?? 0) + 1;
            return acc;
          }, {});
        const byStatus = countBy('status');
        const byPriority = countBy('priority');
        const volume = Array.from({ length: 14 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (13 - i));
          const key = d.toISOString().slice(0, 10);
          const count = tickets.filter((t) => t.createdAt.slice(0, 10) === key).length;
          return { day: key.slice(5), created: count, resolved: Math.max(0, count - 2) };
        });
        return {
          totalTickets: tickets.length,
          openTickets: byStatus.open ?? 0,
          urgentTickets: byPriority.urgent ?? 0,
          customers: tx.all('customers').length,
          lowStock: tx.filter('products', (p) => p.stock <= p.reorderLevel).length,
          byStatus,
          byPriority,
          byCategory: countBy('category'),
          volume,
        };
      }),
    );
  }),

  // ----- Challenge Lab endpoints -------------------------------------------
  http.get('/api/challenges/slow', async () => {
    const latencyMs = Math.round(1500 + Math.random() * 3000);
    await delay(latencyMs);
    return ok({
      latencyMs,
      servedAt: now(),
      items: [
        { id: 'api', label: 'API calls', value: 1284 + Math.round(Math.random() * 500) },
        { id: 'seats', label: 'Seats in use', value: 34 },
        { id: 'storage', label: 'Storage (GB)', value: 128 },
        { id: 'jobs', label: 'Queued jobs', value: Math.round(Math.random() * 20) },
      ],
    });
  }),

  http.get('/api/challenges/flaky', async () => {
    await delay(300);
    if (Math.random() < 0.5) return fail(500, 'Upstream error (simulated)');
    return ok({ value: Math.round((120 + Math.random() * 4800) * 100) / 100 });
  }),

  http.get('/api/challenges/ratelimit', async () => {
    await delay(200);
    rateLimitHits += 1;
    if (rateLimitHits <= 2) {
      return new HttpResponse(JSON.stringify({ message: 'Too many requests — retry shortly' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '1' },
      });
    }
    rateLimitHits = 0;
    return ok({ ok: true });
  }),

  http.get('/api/challenges/timeout', async () => {
    await delay(6000);
    return ok({ ok: true });
  }),

  http.get('/api/challenges/feed', async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const pageSize = 10;
    const total = 54;
    await delay(350 + Math.random() * 450);
    const start = (page - 1) * pageSize;
    const count = Math.max(0, Math.min(pageSize, total - start));
    const messages = ['Heartbeat OK', 'Records synced', 'Cache warmed', 'Index rebuilt', 'Webhook delivered', 'Backup completed'];
    const items = Array.from({ length: count }, (_, i) => {
      const n = start + i + 1;
      const isTarget = n === total;
      return {
        id: `log-${String(n).padStart(3, '0')}`,
        ref: `LOG-${String(n).padStart(4, '0')}`,
        message: isTarget ? 'CRITICAL: cache stampede detected' : messages[n % messages.length],
        level: isTarget ? 'error' : n % 7 === 0 ? 'warn' : 'info',
        at: new Date(Date.UTC(2026, 0, 1) + n * 60000).toISOString(),
      };
    });
    return ok({ items, page, pageSize, total, hasMore: start + count < total });
  }),

  // ----- Embedded analytics (Dashboard iframe at /embed/analytics) ---------------
  // Aggregates for the embedded analytics report. The report itself is an app
  // route rendered inside an iframe: iframe src loads are navigations, which the
  // mock service worker deliberately bypasses, so it can't be an MSW HTML page.
  http.get('/api/analytics', async ({ request }) => {
    await delay(250);
    const requested = Number(new URL(request.url).searchParams.get('days'));
    const days = [7, 30, 90].includes(requested) ? requested : 30;
    const since = Date.now() - days * 86_400_000;

    return ok(
      await read((tx) => {
        const tickets = tx.filter('tickets', (t) => Date.parse(t.createdAt) >= since);
        const open = tickets.filter((t) => t.status === 'open' || t.status === 'pending').length;
        const orders = tx.filter('orders', (o) => Date.parse(o.createdAt) >= since && o.status !== 'cancelled');

        const categoryCounts = new Map<string, number>();
        for (const t of tickets) categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);

        const channelTotals = new Map<OrderChannel, { orders: number; revenue: number }>();
        for (const o of orders) {
          const row = channelTotals.get(o.channel) ?? { orders: 0, revenue: 0 };
          row.orders += 1;
          row.revenue += o.total;
          channelTotals.set(o.channel, row);
        }

        return {
          days,
          tickets: tickets.length,
          open,
          resolutionRate: tickets.length ? Math.round(((tickets.length - open) / tickets.length) * 100) : null,
          orders: orders.length,
          revenue: round2(orders.reduce((sum, o) => sum + o.total, 0)),
          categories: [...categoryCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
          channels: [...channelTotals]
            .map(([channel, v]) => ({ channel, orders: v.orders, revenue: round2(v.revenue) }))
            .sort((a, b) => b.revenue - a.revenue),
          generatedAt: now(),
        };
      }),
    );
  }),
];
