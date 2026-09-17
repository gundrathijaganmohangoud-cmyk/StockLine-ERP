// Small colored status pill shared by all list screens.
export default function StatusBadge({ status }) {
  if (!status) return null;
  const cls = 'badge status-' + String(status).toLowerCase();
  return <span className={cls}>{status}</span>;
}
