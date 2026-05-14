import { execSync } from 'child_process';

/**
 * Executes a SQL query using the team-db CLI.
 * Returns the parsed JSON output.
 */
export function query(sql: string) {
  try {
    const command = `team-db "${sql.replace(/"/g, '\\"')}"`;
    const output = execSync(command, { encoding: 'utf-8' });
    return JSON.parse(output);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Escapes a string for use in a SQL query.
 */
export function escape(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}
