interface StatusCardProps {
  icon: string;
  label: string;
  value: string;
  status?: "online" | "offline" | "warning";
}

const statusColors = {
  online: "bg-emerald-100 text-emerald-700",
  offline: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
};

export function StatusCard({ icon, label, value, status }: StatusCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="truncate font-semibold text-gray-900">{value}</p>
        </div>
        {status && (
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${statusColors[status]}`}
            title={status}
          />
        )}
      </div>
    </div>
  );
}
