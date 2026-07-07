import io
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf_report(room_name: str, start_str: str, end_str: str, stats_data: dict, alerts_data: list, raw_data: list = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=15
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=12,
        spaceAfter=6
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=1 # Center
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    table_cell_center = ParagraphStyle(
        'TableCellCenter',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155'),
        alignment=1
    )

    elements = []
    
    # Room-specific Header Title
    room_title = "Cleanroom Environmental Monitoring Report" if room_name.lower() == "cleanroom" else "FabLab Environmental Monitoring Report"
    generated_now = datetime.now().strftime('%d/%m/%Y %H:%M')
    actual_range = stats_data.get("actual_range", "-")
    total_recs = stats_data.get("total_records", 0)
    
    elements.append(Paragraph(room_title, title_style))
    elements.append(Paragraph(f"Filter Range: <b>{start_str}</b> to <b>{end_str}</b> | Actual Data Range: <b>{actual_range}</b> ({total_recs:,} records) | Generated: <b>{generated_now}</b>", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#3b82f6'), spaceAfter=15))
    
    # Section 1: Statistical Summary
    elements.append(Paragraph("1. Environmental Statistical Summary", h2_style))
    
    # Build Stats Table
    stats_table_data = [
        [
            Paragraph("Metric", table_header_style),
            Paragraph("Average Value", table_header_style),
            Paragraph("Minimum", table_header_style),
            Paragraph("Maximum", table_header_style),
            Paragraph("Unit", table_header_style)
        ]
    ]
    
    for item in stats_data.get("metrics", []):
        stats_table_data.append([
            Paragraph(item["name"], table_cell_style),
            Paragraph(str(item["avg"]), table_cell_center),
            Paragraph(str(item["min"]), table_cell_center),
            Paragraph(str(item["max"]), table_cell_center),
            Paragraph(item["unit"], table_cell_center)
        ])
        
    t_stats = Table(stats_table_data, colWidths=[140, 90, 90, 90, 60])
    t_stats.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(t_stats)
    elements.append(Spacer(1, 15))
    
    # Section 2: Incident & Alert Log Summary
    elements.append(Paragraph("2. Safety Breaches & System Incident Logs", h2_style))
    
    if not alerts_data:
        elements.append(Paragraph("<i>No safety breaches or hardware incidents recorded during this timeframe.</i>", table_cell_style))
    else:
        alert_table_data = [
            [
                Paragraph("Timestamp (DD/MM/YYYY)", table_header_style),
                Paragraph("Sensor / Component", table_header_style),
                Paragraph("Trigger Value", table_header_style),
                Paragraph("Details / Description", table_header_style)
            ]
        ]
        for a in alerts_data[:30]: # limit to latest 30 in report for cleanly formatted pages
            t_stamp = str(a.get("timestamp", ""))
            sensor_name = str(a.get("sensor", ""))
            val_str = f"{a.get('value', 0):.1f}"
            msg = str(a.get("message", ""))
            
            alert_table_data.append([
                Paragraph(t_stamp, table_cell_style),
                Paragraph(sensor_name, table_cell_style),
                Paragraph(val_str, table_cell_center),
                Paragraph(msg, table_cell_style)
            ])
            
        t_alerts = Table(alert_table_data, colWidths=[110, 100, 70, 190])
        t_alerts.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#dc2626')), # Red Header for Alerts
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#fef2f2')]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#fca5a5')),
        ]))
        elements.append(t_alerts)
        
    # Section 3: Trend Charts (Generated dynamically from raw_data)
    chart_flowable = None
    if raw_data:
        # Downsample data if it exceeds 500 records to make the PDF lightweight and the chart clean
        max_plot_points = 500
        if len(raw_data) > max_plot_points:
            step = len(raw_data) // max_plot_points
            decimated = raw_data[::step]
            if raw_data[-1] not in decimated:
                decimated.append(raw_data[-1])
            raw_data = decimated

        try:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            import matplotlib.dates as mdates
            
            times = [r.timestamp for r in raw_data if r.timestamp]
            if len(times) > 0:
                if room_name.lower() == "fablab":
                    temp = [r.temperature if (r.temperature is not None and r.temperature != 0.0) else None for r in raw_data]
                    hum = [r.humidity if (r.humidity is not None and r.humidity != 0.0) else None for r in raw_data]
                    eco2 = [r.eco2 if (r.eco2 is not None and r.eco2 != 0) else None for r in raw_data]
                    tvoc = [r.tvoc if (r.tvoc is not None and r.tvoc != 0) else None for r in raw_data]
                    
                    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 6.2))
                    
                    # Temperature & Humidity (Dual Y-axis)
                    ax1.plot(times, temp, label="Temp (°C)", color="#3b82f6", linewidth=1.2)
                    ax1_right = ax1.twinx()
                    ax1_right.plot(times, hum, label="Hum (%)", color="#10b981", linewidth=1.2)
                    
                    ax1.set_ylabel("Temperature (°C)", color="#3b82f6", fontsize=9)
                    ax1_right.set_ylabel("Humidity (%)", color="#10b981", fontsize=9)
                    ax1.tick_params(axis='y', labelcolor="#3b82f6", labelsize=8)
                    ax1_right.tick_params(axis='y', labelcolor="#10b981", labelsize=8)
                    ax1.set_title("Temperature & Humidity Trends", fontsize=10, fontweight='bold', color="#1e293b")
                    
                    lines1, labels1 = ax1.get_legend_handles_labels()
                    lines2, labels2 = ax1_right.get_legend_handles_labels()
                    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left", fontsize=8)
                    ax1.grid(True, linestyle="--", alpha=0.3)
                    
                    # Air Quality (eCO2 & TVOC)
                    ax2.plot(times, eco2, label="eCO2 (ppm)", color="#8b5cf6", linewidth=1.2)
                    ax2_right = ax2.twinx()
                    ax2_right.plot(times, tvoc, label="TVOC (ppb)", color="#f59e0b", linewidth=1.2)
                    
                    ax2.set_ylabel("eCO2 (ppm)", color="#8b5cf6", fontsize=9)
                    ax2_right.set_ylabel("TVOC (ppb)", color="#f59e0b", fontsize=9)
                    ax2.tick_params(axis='y', labelcolor="#8b5cf6", labelsize=8)
                    ax2_right.tick_params(axis='y', labelcolor="#f59e0b", labelsize=8)
                    ax2.set_title("Air Quality (eCO2 & TVOC) Trends", fontsize=10, fontweight='bold', color="#1e293b")
                    
                    lines1, labels1 = ax2.get_legend_handles_labels()
                    lines2, labels2 = ax2_right.get_legend_handles_labels()
                    ax2.legend(lines1 + lines2, labels1 + labels2, loc="upper left", fontsize=8)
                    ax2.grid(True, linestyle="--", alpha=0.3)
                    
                    # Format X Axis
                    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%d/%m %H:%M'))
                    ax2.xaxis.set_major_formatter(mdates.DateFormatter('%d/%m %H:%M'))
                    ax1.tick_params(axis='x', rotation=15, labelsize=7)
                    ax2.tick_params(axis='x', rotation=15, labelsize=7)
                    
                else: # cleanroom
                    dht_t = [r.dht_temp if (r.dht_temp is not None and r.dht_temp != 0.0) else None for r in raw_data]
                    dht_h = [r.dht_hum if (r.dht_hum is not None and r.dht_hum != 0.0) else None for r in raw_data]
                    ds1 = [r.ds1_temp if (r.ds1_temp is not None and r.ds1_temp != 0.0) else None for r in raw_data]
                    ds2 = [r.ds2_temp if (r.ds2_temp is not None and r.ds2_temp != 0.0) else None for r in raw_data]
                    ds3 = [r.ds3_temp if (r.ds3_temp is not None and r.ds3_temp != 0.0) else None for r in raw_data]
                    
                    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 6.2))
                    
                    # Temperatures
                    ax1.plot(times, dht_t, label="DHT Ambient", color="#3b82f6", linewidth=1.2)
                    ax1.plot(times, ds1, label="Air Inlet (DS1)", color="#22d3ee", linewidth=1.2)
                    ax1.plot(times, ds2, label="Optical Table 1 (DS2)", color="#06b6d4", linewidth=1.2)
                    ax1.plot(times, ds3, label="Optical Table 2 (DS3)", color="#0891b2", linewidth=1.2)
                    
                    ax1.set_ylabel("Temperature (°C)", fontsize=9)
                    ax1.tick_params(axis='y', labelsize=8)
                    ax1.set_title("Cleanroom Temperature Trends", fontsize=10, fontweight='bold', color="#1e293b")
                    ax1.legend(loc="upper left", fontsize=8)
                    ax1.grid(True, linestyle="--", alpha=0.3)
                    
                    # Humidity
                    ax2.plot(times, dht_h, label="DHT Humidity", color="#10b981", linewidth=1.2)
                    ax2.set_ylabel("Humidity (%)", fontsize=9)
                    ax2.tick_params(axis='y', labelsize=8)
                    ax2.set_title("Cleanroom Humidity Trends", fontsize=10, fontweight='bold', color="#1e293b")
                    ax2.legend(loc="upper left", fontsize=8)
                    ax2.grid(True, linestyle="--", alpha=0.3)
                    
                    # Format X Axis
                    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%d/%m %H:%M'))
                    ax2.xaxis.set_major_formatter(mdates.DateFormatter('%d/%m %H:%M'))
                    ax1.tick_params(axis='x', rotation=15, labelsize=7)
                    ax2.tick_params(axis='x', rotation=15, labelsize=7)
                
                fig.tight_layout()
                chart_buf = io.BytesIO()
                plt.savefig(chart_buf, format='png', bbox_inches='tight', dpi=180)
                chart_buf.seek(0)
                plt.close(fig)
                
                chart_flowable = Image(chart_buf, width=480, height=330)
        except Exception as plot_err:
            print(f"[PDF Chart] Error plotting pdf chart: {plot_err}")

    if chart_flowable:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("3. Environmental Sensor Trend Charts", h2_style))
        elements.append(chart_flowable)

    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=10))
    elements.append(Paragraph("Confidential Internal Document — National Astronomical Research Institute of Thailand (NARIT)", ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#94a3b8'), alignment=1)))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
