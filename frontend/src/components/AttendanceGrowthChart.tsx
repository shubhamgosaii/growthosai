import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

export default function AttendanceGrowthChart({ data }: any) {
  return (
    <div className="content-card glass">
      <h3>Attendance & Growth</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="attendance"
            stroke="#4ade80"
            strokeWidth={3}
          />
          <Line
            type="monotone"
            dataKey="employees"
            stroke="#60a5fa"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
