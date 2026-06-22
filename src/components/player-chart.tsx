"use client";

import { Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts";

export function PlayerChart({ data }: { data: { contest: string; score: number }[] }) {
  return (
    <div className="h-full min-h-60 w-full overflow-x-auto overflow-y-hidden">
      <AreaChart data={data} width={640} height={260}>
        <XAxis dataKey="contest" stroke="#71717a" />
        <YAxis stroke="#71717a" />
        <Tooltip contentStyle={{ background: "#09090b", border: "1px solid #8E2BFF", color: "white" }} />
        <Area type="monotone" dataKey="score" stroke="#9AFF00" fill="#8E2BFF55" />
      </AreaChart>
    </div>
  );
}
