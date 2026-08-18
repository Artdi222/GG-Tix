export interface AuditLogEntry {
  requestId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  method: string;
  path: string;
  statusCode: number;
  ip: string;
  userAgent?: string;
  timestamp: string;
  durationMs?: number;
}

// In-memory ring buffer for the latest 100 audit entries
const auditBuffer: AuditLogEntry[] = [];
const MAX_AUDIT_LOGS = 100;

export function recordAuditLog(entry: AuditLogEntry): void {
  auditBuffer.unshift(entry);
  if (auditBuffer.length > MAX_AUDIT_LOGS) {
    auditBuffer.pop();
  }
  // Structured console log for observability
  console.log(
    JSON.stringify({
      level: "AUDIT",
      timestamp: entry.timestamp,
      requestId: entry.requestId,
      userId: entry.userId,
      userEmail: entry.userEmail,
      userRole: entry.userRole,
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      ip: entry.ip,
      durationMs: entry.durationMs,
    })
  );
}

export function getAuditLogs(): AuditLogEntry[] {
  return [...auditBuffer];
}
