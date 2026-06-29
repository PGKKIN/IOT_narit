import io
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf_report(room_name: str, start_str: str, end_str: str, stats_data: dict, alerts_data: list) -> bytes:
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
    
    elements.append(Paragraph(room_title, title_style))
    elements.append(Paragraph(f"Range: <b>{start_str}</b> to <b>{end_str}</b> | Generated: <b>{generated_now}</b>", subtitle_style))
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
        
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=10))
    elements.append(Paragraph("Confidential Internal Document — National Astronomical Research Institute of Thailand (NARIT)", ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#94a3b8'), alignment=1)))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
