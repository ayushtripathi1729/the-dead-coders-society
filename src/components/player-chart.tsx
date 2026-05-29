"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function PlayerChart({ data }: { data: { contest: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <XAxis dataKey="contest" stroke="#71717a" />
        <YAxis stroke="#71717a" />
        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #8E2BFF", color: "white" }} />
        <Area type="monotone" dataKey="score" stroke="#9AFF00" fill="#8E2BFF55" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
