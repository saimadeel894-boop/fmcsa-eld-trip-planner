import { useEffect, useRef } from "react";
import type { DayLog, DutyEvent } from "./types";

interface Props {
  dayLog: DayLog;
  carrierName?: string;
  driverName?: string;
}

const STATUS_ROWS: { key: DutyEvent["status"]; label: string; row: number }[] = [
  { key: "off_duty", label: "Off Duty", row: 0 },
  { key: "sleeper", label: "Sleeper Berth", row: 1 },
  { key: "driving", label: "Driving", row: 2 },
  { key: "on_duty", label: "On Duty\n(Not Driving)", row: 3 },
];

const STATUS_COLORS: Record<DutyEvent["status"], string> = {
  off_duty: "#2563eb",
  sleeper: "#7c3aed",
  driving: "#16a34a",
  on_duty: "#d97706",
};

export default function ELDLogSheet({ dayLog, carrierName = "Spotter AI Logistics", driverName = "Driver" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Colors
    const BG = "#fafaf9";
    const BORDER = "#1c1917";
    const GRID_LINE = "#d6d3d1";
    const HEADER_BG = "#1c1917";
    const HEADER_TEXT = "#fafaf9";

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // === HEADER ===
    const headerH = 90;
    ctx.fillStyle = HEADER_BG;
    ctx.fillRect(0, 0, W, headerH);

    ctx.fillStyle = HEADER_TEXT;
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillText("DRIVER'S DAILY LOG", W / 2 - 80, 22);

    ctx.font = "10px 'Courier New', monospace";
    ctx.fillText("U.S. DEPARTMENT OF TRANSPORTATION", 12, 42);
    ctx.fillText(`${dayLog.date_label.toUpperCase()}  —  24 HOURS`, W / 2 - 60, 42);
    ctx.fillText("ORIGINAL — File at home terminal", W - 240, 42);

    ctx.font = "11px 'Courier New', monospace";
    ctx.fillText(`CARRIER: ${carrierName}`, 12, 62);
    ctx.fillText(`DRIVER: ${driverName}`, 12, 78);

    // Totals area
    const totBox = { x: W - 160, y: 52, w: 148, h: 32 };
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(totBox.x, totBox.y, totBox.w, totBox.h);
    ctx.fillStyle = HEADER_TEXT;
    ctx.font = "9px 'Courier New', monospace";
    ctx.fillText(`Drive: ${dayLog.total_driving.toFixed(2)}h`, totBox.x + 6, totBox.y + 13);
    ctx.fillText(`On-Duty: ${dayLog.total_on_duty.toFixed(2)}h`, totBox.x + 6, totBox.y + 26);

    // === GRID AREA ===
    const gridTop = headerH + 8;
    const gridLeft = 110;
    const gridRight = W - 80;
    const gridWidth = gridRight - gridLeft;
    const rowH = 36;
    const numRows = 4;
    const gridH = rowH * numRows;

    // Row labels
    STATUS_ROWS.forEach(({ label }, i) => {
      ctx.fillStyle = "#1c1917";
      ctx.font = "9px 'Courier New', monospace";
      const lines = label.split("\n");
      lines.forEach((line, li) => {
        ctx.fillText(line, 4, gridTop + i * rowH + rowH / 2 - (lines.length - 1) * 5 + li * 11);
      });
    });

    // Outer grid border
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gridLeft, gridTop, gridWidth, gridH);

    // Hour tick marks (0-23, each hour = gridWidth/24 px)
    const hourW = gridWidth / 24;

    // Vertical grid lines
    for (let h = 0; h <= 24; h++) {
      const x = gridLeft + h * hourW;
      ctx.beginPath();
      ctx.strokeStyle = h === 0 || h === 12 || h === 24 ? BORDER : GRID_LINE;
      ctx.lineWidth = h === 0 || h === 12 || h === 24 ? 1.5 : 0.5;
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridTop + gridH);
      ctx.stroke();

      // Quarter-hour ticks
      if (h < 24) {
        for (let q = 1; q < 4; q++) {
          const qx = x + (q * hourW) / 4;
          ctx.beginPath();
          ctx.strokeStyle = "#c7c3c0";
          ctx.lineWidth = 0.3;
          ctx.moveTo(qx, gridTop);
          ctx.lineTo(qx, gridTop + gridH);
          ctx.stroke();
        }
      }
    }

    // Horizontal row dividers
    for (let r = 0; r <= numRows; r++) {
      const y = gridTop + r * rowH;
      ctx.beginPath();
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.moveTo(gridLeft, y);
      ctx.lineTo(gridRight, y);
      ctx.stroke();
    }

    // Hour labels above grid
    ctx.fillStyle = "#57534e";
    ctx.font = "8px 'Courier New', monospace";
    const hourLabels = ["Mid", "1","2","3","4","5","6","7","8","9","10","11","Noon","1","2","3","4","5","6","7","8","9","10","11","Mid"];
    hourLabels.forEach((lbl, i) => {
      const x = gridLeft + i * hourW - (lbl.length > 1 ? 6 : 3);
      ctx.fillText(lbl, x, gridTop - 3);
    });

    // === DRAW DUTY STATUS LINES ===
    dayLog.events.forEach((event) => {
      const rowInfo = STATUS_ROWS.find((r) => r.key === event.status);
      if (!rowInfo) return;

      const rowY = gridTop + rowInfo.row * rowH;
      const lineY = rowY + rowH / 2;

      const startX = gridLeft + (event.start_hour % 24) * hourW;
      const endX = gridLeft + (event.end_hour % 24) * hourW;

      // If event crosses midnight, clamp to 24
      const clampedEnd = Math.min(gridLeft + 24 * hourW, endX);

      // Thick horizontal duty line
      ctx.beginPath();
      ctx.strokeStyle = STATUS_COLORS[event.status];
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.moveTo(startX, lineY);
      ctx.lineTo(clampedEnd, lineY);
      ctx.stroke();

      // Vertical connectors to show transitions
      // (draw small vertical line at start if not row 0)
    });

    // Draw vertical transition lines between consecutive events
    const sorted = [...dayLog.events].sort((a, b) => a.start_hour - b.start_hour);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (Math.abs(prev.end_hour - curr.start_hour) < 0.01) {
        const prevRow = STATUS_ROWS.find((r) => r.key === prev.status);
        const currRow = STATUS_ROWS.find((r) => r.key === curr.status);
        if (prevRow && currRow && prevRow.row !== currRow.row) {
          const x = gridLeft + (curr.start_hour % 24) * hourW;
          const y1 = gridTop + prevRow.row * rowH + rowH / 2;
          const y2 = gridTop + currRow.row * rowH + rowH / 2;
          ctx.beginPath();
          ctx.strokeStyle = STATUS_COLORS[curr.status];
          ctx.lineWidth = 2;
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
        }
      }
    }

    // === TOTALS COLUMN ===
    const totX = gridRight + 4;
    ctx.fillStyle = "#1c1917";
    ctx.font = "bold 8px 'Courier New', monospace";
    ctx.fillText("Total", totX, gridTop + 8);
    ctx.fillText("Hours", totX, gridTop + 18);

    const rowTotals: Record<DutyEvent["status"], number> = {
      off_duty: 0,
      sleeper: 0,
      driving: 0,
      on_duty: 0,
    };
    dayLog.events.forEach((e) => {
      rowTotals[e.status] += e.duration;
    });

    STATUS_ROWS.forEach(({ key }, i) => {
      const val = rowTotals[key].toFixed(2);
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillStyle = STATUS_COLORS[key];
      ctx.fillText(val, totX, gridTop + i * rowH + rowH / 2 + 4);
    });

    // Grand total check
    const grandTotal = Object.values(rowTotals).reduce((a, b) => a + b, 0);
    ctx.fillStyle = "#57534e";
    ctx.font = "8px 'Courier New', monospace";
    ctx.fillText(`=${grandTotal.toFixed(1)}h`, totX, gridTop + gridH + 12);

    // === REMARKS SECTION ===
    const remarksTop = gridTop + gridH + 24;
    ctx.fillStyle = BORDER;
    ctx.font = "bold 9px 'Courier New', monospace";
    ctx.fillText("REMARKS:", gridLeft, remarksTop);

    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(gridLeft, remarksTop + 4, gridWidth, 60);

    // Extract location changes
    ctx.font = "8px 'Courier New', monospace";
    ctx.fillStyle = "#44403c";
    const uniqueLocations = [...new Set(dayLog.events.map((e) => e.location).filter(Boolean))];
    uniqueLocations.slice(0, 4).forEach((loc, i) => {
      const shortLoc = loc.length > 60 ? loc.substring(0, 57) + "..." : loc;
      ctx.fillText(`• ${shortLoc}`, gridLeft + 6, remarksTop + 18 + i * 12);
    });

  }, [dayLog, carrierName, driverName]);

  return (
    <div style={{ background: "#fff", border: "1px solid #d6d3d1", borderRadius: 4, marginBottom: 16 }}>
      <canvas
        ref={canvasRef}
        width={900}
        height={310}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    </div>
  );
}
