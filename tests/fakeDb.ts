/**
 * In-memory fake DB implementing the DbClient interface for invoice-service
 * tests. Supports the SQL subset used by src/lib/invoice.ts:
 *   SELECT col, col FROM t [WHERE col = val] [ORDER BY col [DESC]]
 *   SELECT * FROM t [WHERE col = val] [ORDER BY col [DESC]]
 *   SELECT COUNT(*) AS c FROM t
 *   SELECT last_insert_rowid() AS id
 *   INSERT INTO t (cols) VALUES (vals)
 *   UPDATE t SET col = val, ... WHERE col = val
 *   DELETE FROM t WHERE col = val
 * Quote-aware: string values are single-quoted with '' escapes.
 */

type Row = Record<string, any>;

function splitQuoted(input: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") {
      if (inQuote && input[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      inQuote = !inQuote;
      cur += ch;
    } else if ((ch === ',' || ch === ' ') && !inQuote) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** Split on commas only, quote-aware (for SET clauses where `col = val` keeps spaces). */
function splitCommas(input: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") {
      if (inQuote && input[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      inQuote = !inQuote;
      cur += ch;
    } else if (ch === ',' && !inQuote) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseValue(raw: string): string | number | null {
  if (raw === 'NULL') return null;
  if (raw.startsWith("'") && raw.endsWith("'")) {
    const s = raw.slice(1, -1).replace(/''/g, "'");
    // Mimic SQLite INTEGER-affinity coercion for integer-looking strings.
    if (/^-?\d+$/.test(s)) return Number(s);
    return s;
  }
  const num = Number(raw);
  return Number.isNaN(num) ? raw : num;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class FakeDb {
  tables: Record<string, Row[]> = {};
  lastInsertId: number | null = null;

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [name, rows] of Object.entries(seed)) {
      this.tables[name] = rows.map((r) => ({ ...r }));
    }
  }

  query(sql: string): any {
    sql = sql.replace(/\s+/g, ' ').trim();

    if (/^SELECT last_insert_rowid\(\) AS id/.test(sql)) {
      return [{ id: this.lastInsertId }];
    }

    let m = /^SELECT (.+?) FROM (\w+)(?: WHERE (.+?))?(?: ORDER BY (.+?))?$/.exec(sql);
    if (m) {
      const [, selExpr, table, where, orderBy] = m;
      const rows = this.tables[table] ?? [];
      let result = rows.map((r) => ({ ...r }));
      if (where) {
        result = result.filter((r) => this.matchesWhere(r, where));
      }
      if (orderBy) {
        const [col, dir] = orderBy.split(/\s+/);
        const sign = dir === 'DESC' ? -1 : 1;
        result.sort((a, b) => (a[col] > b[col] ? sign : a[col] < b[col] ? -sign : 0));
      }
      if (selExpr.trim() === '*') return result;
      if (/^COUNT\(\*\)/.test(selExpr)) return [{ c: result.length }];
      const cols = selExpr.split(',').map((c) => c.trim().split(/\s+AS\s+/i)[0].trim());
      return result.map((r) => {
        const out: Row = {};
        for (const c of cols) out[c] = r[c];
        return out;
      });
    }

    m = /^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([\s\S]*)\)$/.exec(sql);
    if (m) {
      const [, table, colsRaw, valsRaw] = m;
      const cols = splitQuoted(colsRaw).map((c) => c.replace(/[()]/g, '').trim());
      const vals = splitQuoted(valsRaw);
      const row: Row = {};
      cols.forEach((c, i) => {
        row[c] = parseValue(vals[i] ?? 'NULL');
      });
      if (!row.id) {
        const rows = this.tables[table] ?? [];
        row.id = rows.length ? Math.max(...rows.map((r) => Number(r.id ?? 0))) + 1 : 1;
      }
      if (!this.tables[table]) this.tables[table] = [];
      this.tables[table].push(row);
      this.lastInsertId = row.id;
      return [];
    }

    m = /^UPDATE (\w+) SET (.+?) WHERE (.+)$/.exec(sql);
    if (m) {
      const [, table, setClause, where] = m;
      // Split SET assignments on commas only (values may contain spaces).
      const assignments = splitCommas(setClause).map((a) => a.split('=').map((s) => s.trim()));
      const rows = this.tables[table] ?? [];
      for (const r of rows) {
        if (this.matchesWhere(r, where)) {
          for (const [col, val] of assignments) {
            // Self-reference (e.g. `paid_at = paid_at`) means "leave unchanged".
            if (val === col) continue;
            r[col] = parseValue(val);
          }
        }
      }
      return [];
    }

    m = /^DELETE FROM (\w+) WHERE (.+)$/.exec(sql);
    if (m) {
      const [, table, where] = m;
      this.tables[table] = (this.tables[table] ?? []).filter((r) => !this.matchesWhere(r, where));
      return [];
    }

    throw new Error(`FakeDb: unsupported SQL: ${sql}`);
  }

  private matchesWhere(row: Row, where: string): boolean {
    // Supports `col = value` (value may be quoted) and simple `col = col2`? Not needed.
    const eq = /^(\w+)\s*=\s*(.+)$/.exec(where);
    if (!eq) throw new Error(`FakeDb: unsupported WHERE: ${where}`);
    const [, col, valRaw] = eq;
    const val = parseValue(valRaw.trim());
    return row[col] === val;
  }

  /** Convenience: assert a table contains exactly the given number of rows. */
  count(table: string): number {
    return (this.tables[table] ?? []).length;
  }
}

export function seedLeads(): Record<string, Row[]> {
  return {
    app_repair_requests: [
      { id: 1, name: 'Michonne', email: 'mbaker789@gmail.com', phone: '830-555-0142', status: 'completed' },
      { id: 2, name: 'Rick Grimes', email: 'rick@example.com', phone: '830-555-0177', status: 'scheduled' },
    ],
    app_final_invoices: [],
    app_invoices: [],
    app_invoice_payments: [],
    app_invoice_events: [],
    app_invoice_notifications: [],
  };
}

export function escapeRegExpForDisplay(s: string): string {
  return escapeRegex(s);
}
